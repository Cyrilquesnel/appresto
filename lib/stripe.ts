import Stripe from 'stripe'

// En beta, STRIPE_SECRET_KEY peut être absent — les routes Stripe retournent 400 dans ce cas
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
  : (null as unknown as Stripe)

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  multi: process.env.STRIPE_PRICE_MULTI ?? '',
} as const

export type Plan = 'starter' | 'pro' | 'multi'

export const PLANS: Record<
  Plan,
  { nom: string; prix: number; description: string; features: string[] }
> = {
  starter: {
    nom: 'Starter',
    prix: 29,
    description: 'Pour démarrer',
    features: ['5 fiches techniques', '2 fournisseurs', 'Analyse photo IA', 'Saisie ventes'],
  },
  pro: {
    nom: 'Pro',
    prix: 59,
    description: 'Pour les pros',
    features: [
      'Fiches illimitées',
      'Fournisseurs illimités',
      'Module PMS/HACCP',
      'Import CSV',
      'Alertes RappelConso',
      'Export PDF',
    ],
  },
  multi: {
    nom: 'Multi',
    prix: 99,
    description: "Jusqu'à 3 établissements",
    features: ['Tout Pro ×3', '3 établissements', 'Dashboard consolidé'],
  },
}
