import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentification stricte
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
      return NextResponse.json({ error: 'Clé service manquante' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // 2. Profil & Isolation Organisation
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return NextResponse.json({ success: true, transactions: [] })
    }

    // 🛡️ SÉCURITÉ : Filtrage obligatoire par organization_id
    const { data, error } = await supabaseAdmin
      .from('bank_transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('bank_date', { ascending: false })

    if (error) {
      console.warn('[BANQUE API] Erreur sélection Supabase:', error.message)
      return NextResponse.json({
        success: true,
        transactions: [],
        warning: 'Synchronisation bancaire en cours'
      })
    }

    return NextResponse.json({ success: true, transactions: data || [] })
  } catch (error: unknown) {
    console.error('Erreur API Banque GET:', error)
    return NextResponse.json({ success: true, transactions: [] })
  }
}
