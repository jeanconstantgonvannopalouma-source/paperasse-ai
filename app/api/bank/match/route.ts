import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { bankTxId, action, transactionId } = await request.json()

    if (!bankTxId || !action) {
      return NextResponse.json({ error: 'bankTxId et action requis' }, { status: 400 })
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
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })
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

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return NextResponse.json({ error: 'Aucune organisation rattachée' }, { status: 400 })
    }

    // 🛡️ SÉCURITÉ MULTI-TENANT : Vérifier que la ligne bancaire appartient bien à cette organisation
    const { data: bankTx, error: bankErr } = await supabaseAdmin
      .from('bank_transactions')
      .select('id')
      .eq('id', bankTxId)
      .eq('organization_id', organizationId)
      .single()

    if (bankErr || !bankTx) {
      return NextResponse.json({ error: 'Ligne bancaire introuvable ou accès refusé' }, { status: 404 })
    }

    if (action === 'match' && transactionId) {
      // Vérifier que la transaction comptable appartient aussi à cette organisation
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .select('id, document_id')
        .eq('id', transactionId)
        .eq('organization_id', organizationId)
        .single()

      if (!tx) {
        return NextResponse.json({ error: 'Écriture comptable introuvable' }, { status: 404 })
      }

      await supabaseAdmin
        .from('bank_transactions')
        .update({
          status: 'matched',
          matched_transaction_id: transactionId,
          matched_document_id: tx.document_id || null,
        })
        .eq('id', bankTxId)

      return NextResponse.json({ success: true, message: 'Ligne bancaire rapprochée avec succès !' })
    } else if (action === 'ignore') {
      await supabaseAdmin
        .from('bank_transactions')
        .update({
          status: 'ignored',
          matched_transaction_id: null,
          matched_document_id: null,
        })
        .eq('id', bankTxId)

      return NextResponse.json({ success: true, message: 'Ligne bancaire ignorée.' })
    } else if (action === 'unmatch') {
      await supabaseAdmin
        .from('bank_transactions')
        .update({
          status: 'unmatched',
          matched_transaction_id: null,
          matched_document_id: null,
        })
        .eq('id', bankTxId)

      return NextResponse.json({ success: true, message: 'Rapprochement réinitialisé.' })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error: unknown) {
    console.error('Erreur Match Banque:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
