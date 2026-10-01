import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getAuthContext(request: NextRequest) {
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

  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return { user: null, orgId: null, admin: null }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.organization_id || null
  if (!orgId) {
    const { data: anyOrg } = await admin.from('organizations').select('id').limit(1).maybeSingle()
    orgId = anyOrg?.id || null
    if (orgId) {
      await admin.from('profiles').upsert({ id: user.id, organization_id: orgId, email: user.email })
    }
  }

  return { user, orgId, admin }
}

export async function GET(request: NextRequest) {
  try {
    const { user, orgId, admin } = await getAuthContext(request)
    if (!user || !admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    let query = admin.from('chantiers').select('*').order('created_at', { ascending: false })
    if (orgId) query = query.eq('organization_id', orgId)

    let { data, error } = await query
    if (error) throw error

    if ((!data || data.length === 0) && orgId) {
      const { data: all } = await admin.from('chantiers').select('*').order('created_at', { ascending: false })
      if (all?.length) data = all
    }

    const chantiers = data || []

    let txQuery = admin.from('transactions').select('id, chantier_id, document_id, transaction_type, amount_ht, amount_ttc')
    if (orgId) txQuery = txQuery.eq('organization_id', orgId)
    const { data: txsRaw } = await txQuery
    let txs = txsRaw || []

    // Auto-link orphelines si 1 seul chantier
    if (chantiers.length === 1) {
      const only = chantiers[0]
      const orphans = txs.filter((t: any) => !t.chantier_id)
      if (orphans.length) {
        const ids = orphans.map((t: any) => t.id)
        await admin.from('transactions').update({ chantier_id: only.id }).in('id', ids)
        const docIds = orphans.map((t: any) => t.document_id).filter(Boolean)
        if (docIds.length) {
          await admin.from('documents').update({ chantier_id: only.id }).in('id', docIds)
        }
        txs = txs.map((t: any) => (!t.chantier_id ? { ...t, chantier_id: only.id } : t))
      }
    }

    const stats: Record<string, { expense: number; income: number; docsCount: number }> = {}
    chantiers.forEach((c: any) => { stats[c.id] = { expense: 0, income: 0, docsCount: 0 } })

    txs.forEach((t: any) => {
      if (!t.chantier_id || !stats[t.chantier_id]) return
      const ht = Math.abs(Number(t.amount_ht || (t.amount_ttc ? Number(t.amount_ttc) / 1.2 : 0)))
      if (t.transaction_type === 'income') stats[t.chantier_id].income += ht
      else stats[t.chantier_id].expense += ht
      stats[t.chantier_id].docsCount += 1
    })

    return NextResponse.json({ success: true, chantiers, stats })
  } catch (e: unknown) {
    console.error('[API CHANTIERS GET]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user, orgId, admin } = await getAuthContext(request)
    if (!user || !admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: 'Aucune organisation' }, { status: 400 })
    if (!body.name?.trim()) return NextResponse.json({ error: 'Nom obligatoire' }, { status: 400 })

    const payload = {
      organization_id: orgId,
      name: body.name.trim(),
      client_name: body.client_name?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      postal_code: body.postal_code?.trim() || null,
      status: body.status || 'en_cours',
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      budget_ht: body.budget_ht != null && body.budget_ht !== '' ? Number(String(body.budget_ht).replace(',', '.')) : null,
      notes: body.notes?.trim() || null,
    }

    if (body.id) {
      const { data, error } = await admin.from('chantiers').update(payload).eq('id', body.id).select().single()
      if (error) throw error
      return NextResponse.json({ success: true, chantier: data })
    }

    const { data, error } = await admin.from('chantiers').insert(payload).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, chantier: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const { user, orgId, admin } = await getAuthContext(request)
    if (!user || !admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    let q = admin.from('chantiers').delete().eq('id', id)
    if (orgId) q = q.eq('organization_id', orgId)
    const { error } = await q
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}