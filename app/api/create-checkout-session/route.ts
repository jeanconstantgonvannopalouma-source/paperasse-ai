import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('sk_test_51...')) {
      return NextResponse.json({ 
        error: 'STRIPE_SECRET_KEY non configurée. Veuillez ajouter votre vraie clé sk_test_... dans .env.local' 
      }, { status: 500 })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any })

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
      return NextResponse.json({ error: 'Clé serveur manquante' }, { status: 500 })
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

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    // 2. Gestion du Customer Stripe (Création ou Réutilisation)
    let customerId = org?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org?.name || 'Entreprise BTP',
        metadata: {
          organization_id: orgId,
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Sauvegarde sécurisée sans .catch()
      try {
        await supabaseAdmin
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgId)
      } catch (e) {
        console.warn('[STRIPE] Erreur sauvegarde customer_id BDD:', e)
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

    const body = await request.json().catch(() => ({}))
    const interval = body.interval === 'year' ? 'year' : 'month'
    const unitAmount = interval === 'year' ? 39000 : 3900 // 390€/an ou 39€/mois

    // 3. Session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      client_reference_id: orgId,
      metadata: {
        organization_id: orgId,
        user_id: user.id,
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Paperasse.ai — Abonnement Pro BTP',
              description: 'Scan IA illimité, Suivi de Marge par Chantier, Facturation BTP & Exports FEC',
            },
            unit_amount: unitAmount,
            recurring: {
              interval: interval,
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          organization_id: orgId,
        },
      },
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (error: unknown) {
    console.error('[STRIPE CHECKOUT ERR]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur Stripe Checkout' }, { status: 500 })
  }
}