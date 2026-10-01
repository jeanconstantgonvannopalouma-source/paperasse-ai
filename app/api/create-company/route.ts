import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète' }, { status: 500 })
    }

    const supabaseAuth = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceKey)
    const body = await request.json().catch(() => ({}))

    const { companyName, siret } = body
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return NextResponse.json({ error: 'Le nom de l\'entreprise est requis' }, { status: 400 })
    }

    // Création organisation
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: companyName.trim(),
        siret: siret ? siret.trim() : null,
        email: user.email,
      })
      .select('id')
      .single()

    if (orgErr || !org) {
      throw new Error(orgErr?.message || 'Erreur lors de la création de l\'organisation')
    }

    // Lien du profil
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        organization_id: org.id,
        email: user.email,
      })

    return NextResponse.json({ success: true, organizationId: org.id })
  } catch (error: unknown) {
    console.error('[CREATE COMPANY ERR]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur création entreprise' }, { status: 500 })
  }
}