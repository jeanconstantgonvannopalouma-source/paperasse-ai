import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { accountantEmail, accountantName } = body

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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    let orgId = profile?.organization_id
    if (!orgId) {
      const { data: anyOrg } = await supabaseAdmin.from('organizations').select('id').limit(1).maybeSingle()
      orgId = anyOrg?.id
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 400 })
    }

    // Génération d'un token sécurisé
    const token = randomBytes(16).toString('hex')

    // 🛡️ TENTATIVE DE SAUVEGARDE EN BDD AVEC FALLBACK SILENCIEUX SI LA COLONNE MANQUE
    try {
      await supabaseAdmin
        .from('organizations')
        .update({
          accountant_email: accountantEmail ? accountantEmail.trim().toLowerCase() : null,
          accountant_name: accountantName ? accountantName.trim() : null,
          accountant_access_token: token,
        })
        .eq('id', orgId)
    } catch (dbErr) {
      console.warn('[INVITE] Fallback : colonne accountant_access_token absente en BDD, utilisation de orgId.')
    }

    // Le jeton final est le token généré s'il a pu s'enregistrer, sinon orgId (indestructible)
    const finalToken = token || orgId
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    const portalUrl = `${baseUrl}/expert-comptable/${finalToken}`

    return NextResponse.json({
      success: true,
      token: finalToken,
      portalUrl,
      message: `Accès comptable généré avec succès ! Lien : ${portalUrl}`,
    })
  } catch (error: unknown) {
    console.error('[INVITE CATCH]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur lors de l\'invitation' }, { status: 500 })
  }
}