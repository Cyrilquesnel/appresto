import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PRICE_IDS, type Plan } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = request.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  const { plan } = (await request.json()) as { plan: Plan }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json(
      { error: `Prix Stripe non configuré pour le plan ${plan}` },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.miseonplace.fr'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { restaurant_id: restaurantId, plan },
    },
    payment_method_collection:
      process.env.REQUIRE_PAYMENT_METHOD === 'true' ? 'always' : 'if_required',
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/abonnement`,
    metadata: { restaurant_id: restaurantId, plan },
  })

  return NextResponse.json({ url: session.url })
}
