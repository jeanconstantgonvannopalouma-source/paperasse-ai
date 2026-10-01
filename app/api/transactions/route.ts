import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getServiceClient(request: NextRequest) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } }
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: NextResponse.json({ error: 'Clé serveur manquante' }, { status: 500 }) }
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  return { user, supabase }
}

async function resolveOrgId(supabase: any, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  let orgId = profile?.organization_id || null
  if (!orgId) {
    const { data: anyOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
    if (anyOrg?.id) {
      orgId = anyOrg.id
      await supabase.from('profiles').upsert({ id: userId, organization_id: orgId })
    }
  }
  return orgId
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getServiceClient(request)
    if ('error' in ctx && ctx.error) return ctx.error
    const { user, supabase } = ctx as any
    const orgId = await resolveOrgId(supabase, user.id)

    let query = supabase.from('transactions').select('*, chantiers(id, name)').order('created_at', { ascending: false })
    if (orgId) query = query.eq('organization_id', orgId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, transactions: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur GET' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getServiceClient(request)
    if ('error' in ctx && ctx.error) return ctx.error
    const { user, supabase } = ctx as any
    const body = await request.json()
    const { id, chantier_id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const orgId = await resolveOrgId(supabase, user.id)

    // 🛡️ SÉCURITÉ : Empêcher de modifier une Facture Client émise (Loi Anti-Fraude TVA)
    const { data: existingTx } = await supabase.from('transactions').select('transaction_type, invoice_number').eq('id', id).single()
    if (existingTx?.transaction_type === 'income' && existingTx?.invoice_number?.startsWith('FACT')) {
      return NextResponse.json({ error: 'Légalement, une facture émise ne peut être modifiée. Faites un avoir.' }, { status: 403 })
    }

    const payload = { chantier_id: chantier_id && chantier_id !== 'none' ? chantier_id : null }
    let q = supabase.from('transactions').update(payload).eq('id', id)
    if (orgId) q = q.eq('organization_id', orgId)
    
    const { data: tx, error } = await q.select('*, chantiers(id, name)').single()
    if (error) throw error

    // Sync avec le document si existant
    if (tx?.document_id) {
      await supabase.from('documents').update({ chantier_id: payload.chantier_id }).eq('id', tx.document_id)
    }

    return NextResponse.json({ success: true, transaction: tx })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur PATCH' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getServiceClient(request)
    if ('error' in ctx && ctx.error) return ctx.error
    const { user, supabase } = ctx as any

    const body = await request.json().catch(() => ({}))
    const id = body.id as string
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const orgId = await resolveOrgId(supabase, user.id)

    // 1. Récupérer les infos de la transaction avant suppression
    let q = supabase.from('transactions').select('*').eq('id', id)
    if (orgId) q = q.eq('organization_id', orgId)
    const { data: txToDelete } = await q.single()

    if (!txToDelete) return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })

    // 🛡️ SÉCURITÉ LÉGALE : Interdiction de supprimer une facture client !
    if (txToDelete.transaction_type === 'income' && txToDelete.invoice_number?.startsWith('FACT')) {
      return NextResponse.json({ error: 'Interdit : Une facture client officielle ne peut pas être supprimée de la comptabilité.' }, { status: 403 })
    }

    // 2. Suppression de la transaction
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error

    // 3. COHÉRENCE 1 : Remettre le document en "À vérifier"
    if (txToDelete.document_id) {
      await supabase.from('documents')
        .update({ status: 'analyzed' })
        .eq('id', txToDelete.document_id)
    }

    // 4. COHÉRENCE 2 : Délier la banque (remettre en non-rapproché)
    await supabase.from('bank_transactions')
      .update({ status: 'unmatched', matched_transaction_id: null, matched_document_id: null })
      .eq('matched_transaction_id', id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur DELETE' }, { status: 500 })
  }
}