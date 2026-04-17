import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { crediterParrain } from '@/lib/brigade'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const restaurantId = sub.metadata?.restaurant_id
      const plan = sub.metadata?.plan ?? 'pro'

      if (restaurantId) {
        await supabase.from('subscriptions').upsert(
          {
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            restaurant_id: restaurantId,
            plan,
            statut: sub.status,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            current_period_end: new Date(
              (sub as Stripe.Subscription & { current_period_end: number }).current_period_end *
                1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' }
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('subscriptions')
        .update({ statut: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Crédite le parrain si ce paiement correspond à un parrainage Brigade
      if (customerId) {
        try {
          // Récupère le customer Stripe pour accéder à ses métadonnées
          const customer = await stripe!.customers.retrieve(customerId)
          if (customer && !customer.deleted) {
            const referralCode = (customer as Stripe.Customer).metadata?.referral_code
            if (referralCode) {
              // Cherche le referral correspondant à ce code
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: referral } = await (supabase.from as any)('referrals')
                .select('id, parrain_restaurant_id, stripe_coupon_parrain, statut')
                .eq('code', referralCode)
                .maybeSingle()

              if (referral && referral.statut === 'registered') {
                const now = new Date().toISOString()

                // Met à jour statut → converted
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from as any)('referrals')
                  .update({ statut: 'converted', converted_at: now })
                  .eq('id', referral.id)

                // Crédite le parrain avec son coupon
                if (referral.stripe_coupon_parrain) {
                  try {
                    await crediterParrain(
                      referral.parrain_restaurant_id,
                      referral.stripe_coupon_parrain
                    )

                    // Met à jour statut → credited
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase.from as any)('referrals')
                      .update({ statut: 'credited', credited_at: new Date().toISOString() })
                      .eq('id', referral.id)
                  } catch (err) {
                    console.error('[stripe/webhook] Erreur crédit parrain Brigade:', err)
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('[stripe/webhook] Erreur traitement Brigade:', err)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      console.error('[stripe/webhook] Payment failed for:', invoice.customer_email)
      // TODO: envoyer email via Resend
      break
    }
  }

  return NextResponse.json({ received: true })
}
