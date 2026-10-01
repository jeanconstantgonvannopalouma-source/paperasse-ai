import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Map les catégories vers les vrais comptes du Plan Comptable Général (PCG BTP)
function getPurchaseAccount(category: string | null): { num: string; lib: string } {
  const cat = (category || '').toLowerCase()
  if (cat.includes('sous-trait') || cat.includes('soustrait')) {
    return { num: '604000', lib: 'Achats d études et prestations sous-traitance BTP' }
  }
  if (cat.includes('outil') || cat.includes('equipement') || cat.includes('matériel') || cat.includes('materiel')) {
    return { num: '606300', lib: 'Fournitures d entretien et petit équipement' }
  }
  if (cat.includes('carburant') || cat.includes('transport') || cat.includes('déplacement') || cat.includes('deplacement')) {
    return { num: '625100', lib: 'Voyages et déplacements' }
  }
  if (cat.includes('repas') || cat.includes('resto') || cat.includes('restaurant')) {
    return { num: '625700', lib: 'Réceptions et frais de repas' }
  }
  // Par défaut pour le BTP : Matières premières et fournitures
  return { num: '601000', lib: 'Achats de matières premières et fournitures BTP' }
}

// Nettoie les noms de tiers pour les comptes auxiliaires (ex: "401LEROY" au lieu de "401LEROY MERLIN SA!")
function formatAuxCode(name: string | null, prefix: string): string {
  if (!name) return prefix + '00000'
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
  return prefix + (cleaned || '00000')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const typeFilter = searchParams.get('typeFilter') || 'all'

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, organizations(siret, name)')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id
    const rawSiret = (profile?.organizations as any)?.siret || ''
    // Le SIRET doit comporter 14 chiffres selon la norme DGFiP
    const siret = rawSiret.replace(/[^0-9]/g, '').padStart(14, '0').substring(0, 14)

    // Définition de la plage de dates
    const startDate = dateFrom || `${year}-01-01`
    const endDate = dateTo || `${year}-12-31`

    // Requête sécurisée Supabase
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', orgId)

    if (dateFrom && dateTo) {
      query = query.gte('transaction_date', startDate).lte('transaction_date', endDate)
    }

    if (typeFilter !== 'all') {
      query = query.eq('transaction_type', typeFilter)
    }

    const { data: transactions, error: txErr } = await query.order('transaction_date', { ascending: true })

    if (txErr) throw txErr

    // En-têtes officiels FEC (Séparateur Tabulation \t)
    const fecHeaders = [
      'JournalCode',
      'JournalLib',
      'EcritureNum',
      'EcritureDate',
      'CompteNum',
      'CompteLib',
      'CompteAuxNum',
      'CompteAuxLib',
      'PieceRef',
      'PieceDate',
      'EcritureLib',
      'Debit',
      'Credit',
      'EcritureLet',
      'DateLet',
      'ValidDate',
      'Montantdevise',
      'Idevise',
    ].join('\t')

    const fecRows: string[] = []
    let ecritureIndex = 1

    for (const t of transactions || []) {
      const rawDate = t.transaction_date || t.created_at.slice(0, 10)
      const dateStr = rawDate.replace(/-/g, '')
      const pieceRef = (t.invoice_number || `REC-${t.id.slice(0, 6)}`).replace(/[\t\r\n]/g, ' ')
      const tiers = (t.third_party_name || 'TIERS INCONNU').replace(/[\t\r\n]/g, ' ')

      // Calculs financiers stricts avec équilibrage au centime près
      const ttc = Math.round(Math.abs(Number(t.amount_ttc || 0)) * 100) / 100
      let vat = Math.round(Math.abs(Number(t.vat_amount || 0)) * 100) / 100
      let ht = Math.round(Math.abs(Number(t.amount_ht || (ttc - vat))) * 100) / 100

      // Protection équilibre partie double : HT + VAT doit être strictement égal à TTC
      if (ht + vat !== ttc && ttc > 0) {
        ht = Math.round((ttc - vat) * 100) / 100
      }

      if (ttc === 0) continue // On ne génère pas d'écriture à 0.00 €

      const numFormatted = String(ecritureIndex).padStart(6, '0')

      if (t.transaction_type === 'income') {
        // --- ÉCRITURE DE VENTE (Journal VT) ---
        const auxClient = formatAuxCode(tiers, '411')

        // 1. Crédit Ventes (706000) - HT
        fecRows.push([
          'VT', 'Journal Ventes', numFormatted, dateStr, '706000', 'Prestations de services BTP',
          '', '', pieceRef, dateStr, `Vente ${tiers}`, '0.00', ht.toFixed(2), '', '', dateStr, '', ''
        ].join('\t'))

        // 2. Crédit TVA Collectée (445710) - TVA
        if (vat > 0) {
          fecRows.push([
            'VT', 'Journal Ventes', numFormatted, dateStr, '445710', 'TVA collectée',
            '', '', pieceRef, dateStr, `TVA Vente ${tiers}`, '0.00', vat.toFixed(2), '', '', dateStr, '', ''
          ].join('\t'))
        }

        // 3. Débit Client (411100) - TTC
        fecRows.push([
          'VT', 'Journal Ventes', numFormatted, dateStr, '411100', 'Clients - Ventes',
          auxClient, tiers, pieceRef, dateStr, `Facture ${tiers}`, ttc.toFixed(2), '0.00', '', '', dateStr, '', ''
        ].join('\t'))

      } else {
        // --- ÉCRITURE D'ACHAT (Journal HA) ---
        const purchaseAccount = getPurchaseAccount(t.category)
        const auxFournisseur = formatAuxCode(tiers, '401')

        // 1. Débit Achats (601xxx / 604xxx / 625xxx) - HT
        fecRows.push([
          'HA', 'Journal Achats', numFormatted, dateStr, purchaseAccount.num, purchaseAccount.lib,
          '', '', pieceRef, dateStr, `Achat ${tiers}`, ht.toFixed(2), '0.00', '', '', dateStr, '', ''
        ].join('\t'))

        // 2. Débit TVA Déductible (445660) - TVA
        if (vat > 0) {
          fecRows.push([
            'HA', 'Journal Achats', numFormatted, dateStr, '445660', 'TVA déductible sur autres biens et services',
            '', '', pieceRef, dateStr, `TVA Achat ${tiers}`, vat.toFixed(2), '0.00', '', '', dateStr, '', ''
          ].join('\t'))
        }

        // 3. Crédit Fournisseur (401100) - TTC
        fecRows.push([
          'HA', 'Journal Achats', numFormatted, dateStr, '401100', 'Fournisseurs - Achats',
          auxFournisseur, tiers, pieceRef, dateStr, `Facture ${tiers}`, '0.00', ttc.toFixed(2), '', '', dateStr, '', ''
        ].join('\t'))
      }

      ecritureIndex++
    }

    // Le format FEC exige la fin de ligne Windows CRLF (\r\n)
    const fecContent = [fecHeaders, ...fecRows].join('\r\n')

    // Nom officiel DGFiP : [SIRET]FEC[YYYYMMDD].txt
    const formattedEndDate = endDate.replace(/-/g, '')
    const fileName = `${siret}FEC${formattedEndDate}.txt`

    return new Response(fecContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: unknown) {
    console.error('Erreur génération FEC:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur lors de la génération du FEC' }, { status: 500 })
  }
}
