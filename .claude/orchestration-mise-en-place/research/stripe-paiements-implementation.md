# Recherche : Stripe — Paiements & Abonnements

**Date**: 2026-04-12
**Contexte**: SAS La Fabrique Alimentaire, compte Stripe existant, freemium sans CB au départ

---

## 1. Architecture Stripe pour SaaS freemium

### Produits à créer dans Stripe

```typescript
// scripts/setup-stripe-products.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Créer les 3 plans
const products = [
  {
    name: 'Mise en Place Starter',
    metadata: { plan: 'starter', max_plats: '5', max_fournisseurs: '2' }
  },
  {
    name: 'Mise en Place Pro',
    metadata: { plan: 'pro', max_plats: 'unlimited', max_fournisseurs: 'unlimited' }
  },
  {
    name: 'Mise en Place Multi',
    metadata: { plan: 'multi', max_etablissements: '3' }
  }
]

// Prix mensuels (en centimes)
const prices = [
  { product: 'starter', unit_amount: 2900, currency: 'eur' },  // €29
  { product: 'pro', unit_amount: 5900, currency: 'eur' },      // €59
  { product: 'multi', unit_amount: 9900, currency: 'eur' },    // €99
]
```

### Intégration Next.js — Stripe Checkout

```typescript
// app/api/stripe/create-checkout/route.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const { priceId, restaurantId, email } = await request.json()
  
  // Mode sans CB au départ : trial_period_days = 14, pas de payment_method
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { restaurant_id: restaurantId }
    },
    // Sans CB requise (peut switcher via feature flag)
    payment_method_collection: process.env.REQUIRE_PAYMENT_METHOD === 'true'
      ? 'always'
      : 'if_required',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { restaurant_id: restaurantId }
  })
  
  return Response.json({ url: session.url })
}
```

### Webhook Stripe

```typescript
// app/api/stripe/webhook/route.ts
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  const supabase = createServiceClient()
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions').upsert({
        stripe_subscription_id: sub.id,
        restaurant_id: sub.metadata.restaurant_id,
        plan: sub.metadata.plan ?? 'pro',
        statut: sub.status,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'stripe_subscription_id' })
      break
    }
    
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions')
        .update({ statut: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id)
      break
    }
    
    case 'invoice.payment_failed': {
      // Notifier le restaurateur par email
      const invoice = event.data.object as Stripe.Invoice
      // sendPaymentFailedEmail(invoice.customer_email)
      break
    }
  }
  
  return Response.json({ received: true })
}
```

### Table subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT CHECK (plan IN ('starter', 'pro', 'multi')) DEFAULT 'pro',
  statut TEXT DEFAULT 'trialing',
  trial_end TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags basés sur le plan
CREATE OR REPLACE FUNCTION get_plan_limits(p_restaurant_id UUID)
RETURNS JSONB AS $$
  SELECT CASE 
    WHEN s.plan = 'starter' THEN '{"max_plats": 5, "max_fournisseurs": 2, "pms": false}'::JSONB
    WHEN s.plan = 'pro' THEN '{"max_plats": -1, "max_fournisseurs": -1, "pms": true}'::JSONB
    WHEN s.plan = 'multi' THEN '{"max_plats": -1, "max_fournisseurs": -1, "pms": true, "multi_etablissement": true}'::JSONB
    ELSE '{"max_plats": 3, "max_fournisseurs": 1, "pms": false}'::JSONB  -- freemium
  END
  FROM subscriptions s
  WHERE s.restaurant_id = p_restaurant_id
    AND s.statut IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## 2. Variables d'environnement Stripe

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MULTI=price_...
REQUIRE_PAYMENT_METHOD=false  # Feature flag CB requise
```

---

## 3. Coût Stripe

- 1.4% + €0.25 par transaction (cartes européennes)
- 200 clients × €59 × 1.4% = ~€165/mois en frais Stripe (négligeable)
