import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      docType = 'facture',
      clientName,
      clientEmail,
      clientAddress,
      chantierId,
      issueDate,
      dueDate,
      items = [],
      isAutoliquidation = false,
      notes,
      decennaleCompany,
      decennalePolicy,
    } = body

    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return NextResponse.json({ error: 'Le nom ou la raison sociale du client est obligatoire' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La facture doit comporter au moins une ligne de prestation' }, { status: 400 })
    }

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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const orgId = profile?.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Aucune entreprise rattachée à ce compte' }, { status: 400 })
    }

    // 🛡️ AUTO-CREATION / UPSERT DU CLIENT DANS LE CARNET CLIENTS
    try {
      const cleanName = clientName.trim()
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', cleanName)
        .maybeSingle()

      if (!existingClient) {
        await supabaseAdmin.from('clients').insert({
          organization_id: orgId,
          name: cleanName,
          email: clientEmail || null,
          address: clientAddress || null,
          client_type: 'particulier',
        })
      }
    } catch (e: unknown) {
      console.warn('[INVOICES] Auto-client upsert warning:', e)
    }

    let amountHt = 0
    let vatAmount = 0

    const cleanItems = items.map((item: any) => {
      const qte = Math.abs(Number(item.quantity) || 1)
      const pu = Math.abs(Number(item.unitPrice) || 0)
      const rawTvaRate = isAutoliquidation ? 0 : Number(item.vatRate ?? 20)
      const description = (item.description || item.designation || 'Prestation BTP').toString().trim()

      const lineHt = Math.round(qte * pu * 100) / 100
      const lineVat = Math.round(lineHt * (rawTvaRate / 100) * 100) / 100

      amountHt += lineHt
      vatAmount += lineVat

      return {
        description,
        designation: description,
        quantity: qte,
        unitPrice: pu,
        vatRate: rawTvaRate,
        lineHt,
        lineVat,
      }
    })

    amountHt = Math.round(amountHt * 100) / 100
    vatAmount = isAutoliquidation ? 0 : Math.round(vatAmount * 100) / 100
    const amountTtc = isAutoliquidation ? amountHt : Math.round((amountHt + vatAmount) * 100) / 100

    const prefix = docType === 'devis' ? 'DEV' : 'FACT'
    const currentYear = new Date().getFullYear()
    const searchPattern = `${prefix}-${currentYear}-%`

    const { data: lastInvoices } = await supabaseAdmin
      .from('transactions')
      .select('invoice_number')
      .eq('organization_id', orgId)
      .like('invoice_number', searchPattern)
      .order('invoice_number', { ascending: false })
      .limit(1)

    let nextChrono = 1
    if (lastInvoices && lastInvoices.length > 0 && lastInvoices[0].invoice_number) {
      const parts = lastInvoices[0].invoice_number.split('-')
      const lastSeq = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastSeq)) nextChrono = lastSeq + 1
    }

    const invoiceNumber = `${prefix}-${currentYear}-${String(nextChrono).padStart(4, '0')}`
    const cleanIssueDate = issueDate && issueDate.trim() !== '' ? issueDate : new Date().toISOString().slice(0, 10)
    const finalChantierId = chantierId && chantierId !== 'none' ? chantierId : null

    let legalNotes = (notes || '').trim()
    if (decennaleCompany || decennalePolicy) {
      const decLine = `Assurance décennale : ${decennaleCompany || 'N/C'}${decennalePolicy ? ` — Police n° ${decennalePolicy}` : ''}`
      if (!legalNotes.includes('décennale') && !legalNotes.includes('decennale')) {
        legalNotes = legalNotes ? `${legalNotes}\n${decLine}` : decLine
      }
    }
    if (isAutoliquidation && !legalNotes.includes('Autoliquidation')) {
      legalNotes = `${legalNotes}\n\nMention légale : Autoliquidation de la TVA - Article 283-2 nonies du CGI (Sous-traitance BTP).`.trim()
    }

    try {
      await supabaseAdmin.from('client_invoices').insert({
        organization_id: orgId,
        chantier_id: finalChantierId,
        doc_type: docType,
        invoice_number: invoiceNumber,
        client_name: clientName.trim(),
        client_email: clientEmail || null,
        client_address: clientAddress || null,
        issue_date: cleanIssueDate,
        due_date: dueDate || null,
        items: cleanItems,
        amount_ht: amountHt,
        vat_amount: vatAmount,
        amount_ttc: amountTtc,
        is_autoliquidation: isAutoliquidation,
        status: docType === 'facture' ? 'paye' : 'envoye',
        notes: legalNotes || null,
      })
    } catch (e: unknown) {
      console.warn('[INVOICES] Warning client_invoices insert:', e)
    }

    if (docType === 'facture') {
      const { error: txErr } = await supabaseAdmin.from('transactions').insert({
        organization_id: orgId,
        chantier_id: finalChantierId,
        transaction_type: 'income',
        third_party_name: clientName.trim(),
        category: isAutoliquidation ? 'Ventes Autoliquidation BTP' : 'Ventes / Prestations BTP',
        invoice_number: invoiceNumber,
        transaction_date: cleanIssueDate,
        amount_ht: amountHt,
        vat_amount: vatAmount,
        amount_ttc: amountTtc,
        payment_status: 'paid',
        validation_status: 'validated',
      })

      if (txErr) {
        throw new Error(`Erreur enregistrement comptable: ${txErr.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      invoiceNumber,
      amountHt,
      vatAmount,
      amountTtc,
      message: `${docType === 'devis' ? 'Devis' : 'Facture'} N° ${invoiceNumber} créé(e) avec succès !`,
    })
  } catch (error: unknown) {
    console.error('Erreur API Facturation:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur création facture' }, { status: 500 })
  }
}
