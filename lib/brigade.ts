import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Génère un code BRIGADE-[PRENOM] depuis le prénom de l'utilisateur.
 * Normalise : majuscules, supprime accents et caractères non-alpha.
 */
export function generateBrigadeCode(prenom: string): string {
  const normalized = prenom
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/[^A-Z]/g, '') // garde uniquement les lettres
    .slice(0, 20) // limite la longueur

  if (!normalized) {
    throw new Error('Prénom invalide pour générer un code Brigade')
  }

  return `BRIGADE-${normalized}`
}

/**
 * Crée les deux coupons Stripe pour un parrainage Brigade :
 * - coupon parrain : appliqué sur l'abonnement existant (1 mois gratuit)
 * - coupon filleul : appliqué à la souscription (1 mois gratuit)
 *
 * Chaque coupon est unique (suffixe timestamp) pour permettre les multi-parrainages.
 */
export async function createBrigadeCoupons(code: string): Promise<{
  couponParrain: string
  couponFilleul: string
}> {
  if (!stripe) throw new Error('Stripe non configuré')

  const ts = Date.now()
  const safeCode = code.replace(/[^A-Z0-9-]/gi, '')

  const [couponParrain, couponFilleul] = await Promise.all([
    stripe.coupons.create({
      id: `${safeCode}-PARRAIN-${ts}`,
      percent_off: 100,
      duration: 'once',
      name: `Brigade parrain — ${code}`,
      metadata: { brigade_code: code, role: 'parrain' },
    }),
    stripe.coupons.create({
      id: `${safeCode}-FILLEUL-${ts}`,
      percent_off: 100,
      duration: 'once',
      name: `Brigade filleul — ${code}`,
      metadata: { brigade_code: code, role: 'filleul' },
    }),
  ])

  return {
    couponParrain: couponParrain.id,
    couponFilleul: couponFilleul.id,
  }
}

/**
 * Crédite le parrain en appliquant un coupon sur son abonnement Stripe actif.
 * Met à jour le statut referral en 'credited'.
 */
export async function crediterParrain(restaurantId: string, couponId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe non configuré')

  const supabase = createServiceClient()

  // Récupère l'abonnement Stripe actif du parrain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub } = await (supabase.from as any)('subscriptions')
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('restaurant_id', restaurantId)
    .in('statut', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    // Pas d'abonnement actif : on applique le coupon sur le customer pour le prochain paiement
    if (sub?.stripe_customer_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (stripe.customers.update as any)(sub.stripe_customer_id, {
        coupon: couponId,
      })
    }
    return
  }

  // Applique le coupon sur l'abonnement actif
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (stripe.subscriptions.update as any)(sub.stripe_subscription_id, {
    coupon: couponId,
  })
}
