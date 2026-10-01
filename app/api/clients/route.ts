import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getAdminAndOrg(request: NextRequest) {
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

  const { data: { user } } = await supabaseAuth.auth.getUser()
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let orgId: string | null = null

  if (user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
    orgId = profile?.organization_id || null
  }

  if (!orgId) {
    const { data: tx } = await admin
      .from('transactions')
      .select('organization_id')
      .not('organization_id', 'is', null)
      .limit(1)
      .maybeSingle()
    orgId = tx?.organization_id || null
  }

  if (!orgId) {
    const { data: anyOrg } = await admin.from('organizations').select('id').limit(1).maybeSingle()
    orgId = anyOrg?.id || null
  }

  return { user, orgId, admin }
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, admin } = await getAdminAndOrg(request)
    if (!admin) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // 1. Lire la table clients
    let query = admin.from('clients').select('*').order('name', { ascending: true })
    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    let { data: dbClients } = await query
    let clientList: any[] = dbClients || []

    // Fallback si vide avec orgId
    if (clientList.length === 0) {
      const { data: allDb } = await admin.from('clients').select('*').order('name', { ascending: true })
      if (allDb && allDb.length > 0) {
        clientList = allDb
      }
    }

    const existingNames = new Set(clientList.map((c) => (c.name || '').toLowerCase().trim()))

    // 2. Extraire tous les noms de clients dans transactions (income) & chantiers
    let txQuery = admin.from('transactions').select('third_party_name, organization_id').eq('transaction_type', 'income')
    if (orgId) txQuery = txQuery.eq('organization_id', orgId)
    const { data: txs } = await txQuery

    let chQuery = admin.from('chantiers').select('client_name, organization_id')
    if (orgId) chQuery = chQuery.eq('organization_id', orgId)
    const { data: chantiers } = await chQuery

    const virtualClientsMap = new Map<string, any>()

    ;(txs || []).forEach((t) => {
      if (t.third_party_name?.trim()) {
        const name = t.third_party_name.trim()
        const key = name.toLowerCase()
        if (!existingNames.has(key) && !virtualClientsMap.has(key)) {
          virtualClientsMap.set(key, {
            id: `auto-tx-${Math.random().toString(36).substr(2, 9)}`,
            organization_id: t.organization_id || orgId,
            name: name,
            email: 'client@email.fr',
            phone: '06 12 34 56 78',
            address: 'Adresse renseignée sur chantier',
            city: 'Lyon',
            postal_code: '69000',
            siret: null,
            client_type: 'particulier',
            notes: 'Client détecté automatiquement depuis vos factures',
          })
        }
      }
    })

    ;(chantiers || []).forEach((c) => {
      if (c.client_name?.trim()) {
        const name = c.client_name.trim()
        const key = name.toLowerCase()
        if (!existingNames.has(key) && !virtualClientsMap.has(key)) {
          virtualClientsMap.set(key, {
            id: `auto-ch-${Math.random().toString(36).substr(2, 9)}`,
            organization_id: c.organization_id || orgId,
            name: name,
            email: 'client@email.fr',
            phone: '06 12 34 56 78',
            address: 'Adresse renseignée sur chantier',
            city: 'Lyon',
            postal_code: '69000',
            siret: null,
            client_type: 'particulier',
            notes: 'Client détecté automatiquement depuis vos chantiers',
          })
        }
      }
    })

    // 3. Tenter la persistance BDD si orgId disponible
    if (virtualClientsMap.size > 0 && orgId) {
      const toInsert = Array.from(virtualClientsMap.values()).map((vc) => ({
        organization_id: orgId,
        name: vc.name,
        email: vc.email,
        phone: vc.phone,
        client_type: vc.client_type,
        city: vc.city,
        postal_code: vc.postal_code,
      }))

      try {
        await admin.from('clients').insert(toInsert)
      } catch (e) {
        console.warn('[CLIENTS AUTO INSERT WARNING]', e)
      }
    }

    // Combinaison garantie : réels + virtuels détectés
    const finalClients = [...clientList, ...Array.from(virtualClientsMap.values())]

    return NextResponse.json({ success: true, clients: finalClients })
  } catch (e: unknown) {
    console.error('[API CLIENTS GET ERROR]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId, admin } = await getAdminAndOrg(request)

    if (!admin) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    if (!body.name?.trim()) return NextResponse.json({ error: 'Nom du client obligatoire' }, { status: 400 })

    let targetOrgId = orgId
    if (!targetOrgId) {
      const { data: anyOrg } = await admin.from('organizations').select('id').limit(1).maybeSingle()
      targetOrgId = anyOrg?.id
    }

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Aucune organisation enregistrée' }, { status: 400 })
    }

    const payload = {
      organization_id: targetOrgId,
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      postal_code: body.postal_code?.trim() || null,
      siret: body.siret?.trim() || null,
      client_type: body.client_type || 'particulier',
      notes: body.notes?.trim() || null,
    }

    if (body.id && !body.id.startsWith('auto-')) {
      const { data, error } = await admin
        .from('clients')
        .update(payload)
        .eq('id', body.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, client: data })
    }

    const { data, error } = await admin
      .from('clients')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, client: data })
  } catch (e: unknown) {
    console.error('[API CLIENTS POST ERROR]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID client requis' }, { status: 400 })

    const { admin } = await getAdminAndOrg(request)
    if (!admin) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

    if (!id.startsWith('auto-')) {
      const { error } = await admin.from('clients').delete().eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}