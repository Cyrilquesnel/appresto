---
name: stripe-subscriptions
description: Paiements et abonnements Stripe pour Mise en Place. Utilise quand tu implémentes le pricing, le freemium, ou les webhooks Stripe.
---

# Stripe — Abonnements SaaS

## Contexte
- Entité légale : SAS La Fabrique Alimentaire
- Compte Stripe existant ✅
- Freemium 14 jours sans CB requise (feature flag `REQUIRE_PAYMENT_METHOD`)
- Beta testeurs : gratuit, pas de Stripe en MVP

## Plans
| Plan | Prix | Limites |
|---|---|---|
| Starter | €29/mois | 5 plats, 2 fournisseurs, pas de PMS |
| Pro | €59/mois | Illimité, PMS inclus |
| Multi | €99/mois | 3 établissements (commercialisation) |

## Variables d'environnement
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
REQUIRE_PAYMENT_METHOD=false  # switcher si abus
```

## Checkout sans CB (freemium)
```typescript
payment_method_collection: process.env.REQUIRE_PAYMENT_METHOD === 'true' ? 'always' : 'if_required'
```

## Webhook events à gérer
- `customer.subscription.created/updated` → update table `subscriptions`
- `customer.subscription.deleted` → statut 'canceled'
- `invoice.payment_failed` → email restaurateur

## Feature flags via plan
Utiliser la fonction SQL `get_plan_limits(restaurant_id)` pour vérifier les limites.
Ne jamais hardcoder les limites dans le frontend.

## Stripe en MVP vs commercialisation
- **MVP/Beta** : pas de Stripe, tout gratuit
- **Commercialisation** : activer Stripe Checkout + webhooks
- Le code Stripe peut être présent mais désactivé via feature flag jusqu'à la commercialisation

## Références
- Code complet : research/stripe-paiements-implementation.md
