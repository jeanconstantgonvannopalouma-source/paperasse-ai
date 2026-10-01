import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      documentId,
      validate = true,
      extracted_data,
      document_type,
      chantier_id,
      third_party_name,
      category,
      invoice_number,
      transaction_date,
      amount_ht,
      vat_amount,
      amount_ttc,
      payment_status,
      confidence_score,
    } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Identifiant de document obligatoire' }, { status: 400 })
    }

    // 1. Authentification
    const responseHeaders = new Headers()
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
      return NextResponse.json({ error: 'Clé de service introuvable' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // 2. Profil & Organisation
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return NextResponse.json({ error: 'Aucune entreprise rattachée à votre compte' }, { status: 400 })
    }

    // 🛡️ SÉCURITÉ MULTI-TENANT STRICTE : On vérifie que le document appartient bien à L'ORGANISATION de l'utilisateur
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', organizationId)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document introuvable ou accès non autorisé' }, { status: 404 })
    }

    const finalChantierId = chantier_id && chantier_id !== 'none' ? chantier_id : null

    // 3. Mise à jour du Document
    const newStatus = validate ? 'validated' : (doc.status === 'uploaded' ? 'analyzed' : doc.status)

    const { error: docUpdateErr } = await supabaseAdmin
      .from('documents')
      .update({
        extracted_data: extracted_data || doc.extracted_data,
        document_type: document_type || doc.document_type || 'supplier_invoice',
        status: newStatus,
        chantier_id: finalChantierId,
        confidence_score: confidence_score ?? doc.confidence_score ?? 1.0,
      })
      .eq('id', documentId)

    if (docUpdateErr) {
      console.error('[VALIDATE] Erreur mise à jour Document:', docUpdateErr)
      return NextResponse.json({ error: docUpdateErr.message }, { status: 500 })
    }

    // 4. Génération de l'écriture comptable (Transaction)
    if (validate) {
      const docType = document_type || doc.document_type || 'supplier_invoice'
      let txType = 'expense'
      if (docType === 'customer_invoice' || docType === 'quote') {
        txType = 'income'
      } else if (docType === 'receipt') {
        txType = 'receipt'
      }

      // 🧮 CALCUL FINANCIER STRUCTURÉ (Anti-valeurs vides)
      let ttc = Math.abs(Number(amount_ttc || 0))
      let vat = Math.abs(Number(vat_amount || 0))
      let ht = Math.abs(Number(amount_ht || 0))

      if (ttc > 0 && ht === 0) {
        ht = Math.round((ttc / 1.2) * 100) / 100
        vat = Math.round((ttc - ht) * 100) / 100
      } else if (ht > 0 && ttc === 0) {
        vat = Math.round((ht * 0.2) * 100) / 100
        ttc = Math.round((ht + vat) * 100) / 100
      }

      const payload = {
        organization_id: organizationId,
        document_id: documentId,
        chantier_id: finalChantierId,
        transaction_type: txType,
        third_party_name: third_party_name || doc.extracted_data?.third_party_name || doc.file_name,
        category: category || doc.extracted_data?.category || 'Matières premières BTP',
        invoice_number: invoice_number || doc.extracted_data?.invoice_number || null,
        transaction_date: transaction_date || doc.extracted_data?.transaction_date || new Date().toISOString().slice(0, 10),
        amount_ht: ht,
        vat_amount: vat,
        amount_ttc: ttc,
        payment_status: payment_status || 'paid',
        validation_status: 'validated',
      }

      // 🛡️ ANTI-DOUBLONS ATOMIQUE : Upsert sur la transaction liée à ce document_id
      const { data: existingTx } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle()

      if (existingTx?.id) {
        const { error: updateTxErr } = await supabaseAdmin
          .from('transactions')
          .update(payload)
          .eq('id', existingTx.id)

        if (updateTxErr) throw updateTxErr
      } else {
        const { error: insertTxErr } = await supabaseAdmin
          .from('transactions')
          .insert(payload)

        if (insertTxErr) throw insertTxErr
      }
    }

    return NextResponse.json({
      success: true,
      message: validate ? 'Document validé et écriture comptable enregistrée.' : 'Modifications enregistrées.',
    })
  } catch (error: unknown) {
    console.error('[VALIDATE] Erreur API:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur interne de validation' }, { status: 500 })
  }
}
