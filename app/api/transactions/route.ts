import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)

    const { data: profile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
    let orgId = profile?.organization_id

    if (!orgId) {
      const { data: anyOrg } = await supabaseAdmin.from('organizations').select('id').limit(1).maybeSingle()
      orgId = anyOrg?.id
    }

    // 1. Récupérer UNIQUEMENT les transactions (Pas de jointure risquée)
    let txQuery = supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false })
    if (orgId) txQuery = txQuery.eq('organization_id', orgId)
    
    const { data: rawTransactions, error: txError } = await txQuery
    if (txError) throw txError

    const transactions = rawTransactions || []

    // 2. Récupérer les chantiers séparément
    let chQuery = supabaseAdmin.from('chantiers').select('id, name')
    if (orgId) chQuery = chQuery.eq('organization_id', orgId)
    const { data: chantiers } = await chQuery

    const chMap = new Map((chantiers || []).map(c => [c.id, c.name]))

    // 3. Fusion manuelle 100% sécurisée
    const finalTransactions = transactions.map(t => ({
      ...t,
      chantiers: t.chantier_id && chMap.has(t.chantier_id) 
        ? { id: t.chantier_id, name: chMap.get(t.chantier_id) } 
        : null
    }))

    return NextResponse.json({ success: true, transactions: finalTransactions })
  } catch (e: any) {
    console.error('[API TRANSACTIONS GET ERR]', e)
    return NextResponse.json({ error: e.message || 'Erreur Serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    
    const body = await request.json()
    const { id, chantier_id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const payload = { chantier_id: chantier_id && chantier_id !== 'none' ? chantier_id : null }
    
    const { data, error } = await supabaseAdmin.from('transactions').update(payload).eq('id', id).select().single()
    if (error) throw error

    if (data?.document_id) {
      await supabaseAdmin.from('documents').update({ chantier_id: payload.chantier_id }).eq('id', data.document_id)
    }

    return NextResponse.json({ success: true, transaction: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)

    const body = await request.json().catch(() => ({}))
    const id = body.id as string
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data: txToDelete } = await supabaseAdmin.from('transactions').select('*').eq('id', id).single()
    if (!txToDelete) return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })

    const { error } = await supabaseAdmin.from('transactions').delete().eq('id', id)
    if (error) throw error

    if (txToDelete.document_id) {
      await supabaseAdmin.from('documents').update({ status: 'analyzed' }).eq('id', txToDelete.document_id)
    }

    await supabaseAdmin.from('bank_transactions').update({ status: 'unmatched', matched_transaction_id: null, matched_document_id: null }).eq('matched_transaction_id', id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 })
  }
}