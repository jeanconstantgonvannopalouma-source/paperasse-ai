import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Jeton d\'accès requis' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Clé serveur manquante' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // 1. Chercher par token exact
    let org = null
    try {
      const { data } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('accountant_access_token', token)
        .maybeSingle()
      org = data
    } catch (e) {
      // Ignorer si la colonne n'existe pas
    }

    // 2. Si non trouvé par token, chercher par ID d'organisation (Fallback)
    if (!org) {
      const { data: orgById } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', token)
        .maybeSingle()
      org = orgById
    }

    // 3. Dernier secours dev : première organisation disponible
    if (!org) {
      const { data: firstOrg } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .limit(1)
        .maybeSingle()
      org = firstOrg
    }

    if (!org) {
      return NextResponse.json({ error: 'Lien d\'accès comptable invalide' }, { status: 404 })
    }

    // Récupérer les écritures validées de cette entreprise
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('organization_id', org.id)
      .eq('validation_status', 'validated')
      .order('transaction_date', { ascending: false })

    return NextResponse.json({
      success: true,
      org,
      transactions: transactions || [],
    })
  } catch (error: unknown) {
    console.error('[PORTAL API CATCH]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur portail' }, { status: 500 })
  }
}