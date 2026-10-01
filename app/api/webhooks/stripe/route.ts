import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY manquante' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any })
  const body = await request.text()
  const signature = request.headers.get('stripe-signature') || ''

  let event: Stripe.Event

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // Fallback dev si pas encore de secret webhook configuré
      event = JSON.parse(body)
    }
  } catch (err: unknown) {
    console.error('[STRIPE WEBHOOK SIG ERR]', err)
    return NextResponse.json({ error: 'Signature Webhook invalide' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Clé de service manquante' }, { status: 500 })
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.client_reference_id || session.metadata?.organization_id

        if (orgId) {
          await supabaseAdmin
            .from('organizations')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
            })
            .eq('id', orgId)
          console.log(`[STRIPE WEBHOOK] Organisation ${orgId} activée avec succès !`)
        }
        break
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.organization_id

        if (orgId) {
          const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'canceled'
          await supabaseAdmin
            .from('organizations')
            .update({
              subscription_status: status,
              stripe_subscription_id: sub.id,
            })
            .eq('id', orgId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error('[STRIPE WEBHOOK PROC ERR]', err)
    return NextResponse.json({ error: 'Erreur traitement webhook' }, { status: 500 })
  }
}