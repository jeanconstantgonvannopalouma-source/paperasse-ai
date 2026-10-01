import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier bancaire fourni' }, { status: 400 })
    }

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Clé de service manquante' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const orgId = profile?.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Aucune entreprise rattachée à votre compte' }, { status: 400 })
    }

    // 1. Lire le contenu du CSV
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

    if (lines.length < 2) {
      return NextResponse.json({ error: 'Fichier bancaire vide ou incomplet' }, { status: 400 })
    }

    // Chargement des transactions comptables pour le matching
    const { data: existingTransactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('organization_id', orgId)

    // Chargement des lignes bancaires DÉJÀ importées pour l'ANTI-DOUBLON
    const { data: existingBankLines } = await supabaseAdmin
      .from('bank_transactions')
      .select('bank_date, label, amount')
      .eq('organization_id', orgId)

    const existingKeys = new Set(
      (existingBankLines || []).map((b) => `${b.bank_date}_${b.label.trim()}_${Number(b.amount).toFixed(2)}`)
    )

    const separator = lines[0].includes(';') ? ';' : ','
    const importedBankLines = []
    let matchedCount = 0
    let duplicateCount = 0

    // 2. Traitement ligne par ligne
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map((c) => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 2) continue

      const rawDate = cols[0]
      const label = cols[1] || 'Opération bancaire'
      
      // Gestion intelligente des formats 1 colonne (Montant) vs 2 colonnes (Débit / Crédit)
      let amount = 0
      const col2 = (cols[2] || '').replace(/\s/g, '').replace(',', '.')
      const col3 = (cols[3] || '').replace(/\s/g, '').replace(',', '.')

      if (cols.length >= 4 && col2 !== '' && col3 !== '') {
        // Format Débit (col 2) / Crédit (col 3)
        const debit = Math.abs(parseFloat(col2) || 0)
        const credit = Math.abs(parseFloat(col3) || 0)
        amount = credit > 0 ? credit : -debit
      } else {
        // Format unique Montant (col 2 ou 3)
        amount = parseFloat(col2 || col3 || '0')
      }

      if (Number.isNaN(amount) || amount === 0) continue

      // Formater la date en YYYY-MM-DD
      let formattedDate = new Date().toISOString().slice(0, 10)
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/')
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
          formattedDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      } else if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
        formattedDate = rawDate.slice(0, 10)
      }

      // 🛡️ ANTI-DOUBLON : Vérifier si cette ligne bancaire existe déjà
      const lineKey = `${formattedDate}_${label.trim()}_${amount.toFixed(2)}`
      if (existingKeys.has(lineKey)) {
        duplicateCount++
        continue // On saute cette ligne déjà importée
      }

      // 3. Auto-Matching Intelligent
      let matchedTxId: string | null = null
      let matchedDocId: string | null = null
      let status = 'unmatched'

      const absAmount = Math.abs(amount)

      // Recherche par écart de montant (< 5 centimes)
      const match = (existingTransactions || []).find((t) => {
        const tAmount = Math.abs(Number(t.amount_ttc || 0))
        return Math.abs(tAmount - absAmount) < 0.05
      })

      if (match) {
        matchedTxId = match.id
        matchedDocId = match.document_id
        status = 'matched'
        matchedCount++
      }

      // Insertion en BDD
      const { data: insertedBankTx } = await supabaseAdmin
        .from('bank_transactions')
        .insert({
          organization_id: orgId,
          bank_date: formattedDate,
          label,
          amount,
          matched_transaction_id: matchedTxId,
          matched_document_id: matchedDocId,
          status,
        })
        .select()
        .single()

      if (insertedBankTx) {
        importedBankLines.push(insertedBankTx)
        existingKeys.add(lineKey) // Évite aussi les doublons dans le même fichier
      }
    }

    let message = `${importedBankLines.length} nouvelle(s) ligne(s) bancaire(s) importée(s). ${matchedCount} rapprochée(s) automatiquement.`
    if (duplicateCount > 0) {
      message += ` (${duplicateCount} ligne(s) déjà existante(s) ignorée(s)).`
    }

    return NextResponse.json({
      success: true,
      totalImported: importedBankLines.length,
      matchedCount,
      duplicateCount,
      message,
    })
  } catch (error: unknown) {
    console.error('Erreur Import Banque:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur lors de l\'import bancaire' }, { status: 500 })
  }
}
