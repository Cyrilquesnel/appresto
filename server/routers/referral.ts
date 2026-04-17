import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { generateBrigadeCode, createBrigadeCoupons } from '@/lib/brigade'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

interface Referral {
  id: string
  parrain_restaurant_id: string
  code: string
  filleul_email: string | null
  filleul_restaurant_id: string | null
  statut: 'pending' | 'registered' | 'converted' | 'credited'
  stripe_coupon_parrain: string | null
  stripe_coupon_filleul: string | null
  converted_at: string | null
  credited_at: string | null
  created_at: string
}

export const referralRouter = router({
  /**
   * Retourne (ou crée) le code Brigade du restaurant connecté.
   * Lazy creation : le referral n'est créé qu'à la première consultation.
   */
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    // Cherche un referral existant pour ce restaurant
    const { data: existing } = await (ctx.supabase.from as AnyTable)('referrals')
      .select('*')
      .eq('parrain_restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return existing as Referral
    }

    // Détermine le prénom depuis les métadonnées utilisateur ou l'email
    const prenom =
      (ctx.user.user_metadata?.prenom as string | undefined) ||
      (ctx.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ||
      (ctx.user.email ?? '').split('@')[0]

    const code = generateBrigadeCode(prenom)

    // Crée les coupons Stripe
    let couponParrain: string | null = null
    let couponFilleul: string | null = null
    try {
      const coupons = await createBrigadeCoupons(code)
      couponParrain = coupons.couponParrain
      couponFilleul = coupons.couponFilleul
    } catch {
      // Stripe non configuré en dev — on continue sans coupon
    }

    const { data: created, error } = await (ctx.supabase.from as AnyTable)('referrals')
      .insert({
        parrain_restaurant_id: ctx.restaurantId,
        code,
        stripe_coupon_parrain: couponParrain,
        stripe_coupon_filleul: couponFilleul,
        statut: 'pending',
      })
      .select('*')
      .single()

    if (error) {
      // Code déjà pris (UNIQUE) — on retente avec un suffixe numérique
      const codeAlt = `${code}2`
      const { data: created2, error: error2 } = await (ctx.supabase.from as AnyTable)('referrals')
        .insert({
          parrain_restaurant_id: ctx.restaurantId,
          code: codeAlt,
          stripe_coupon_parrain: null,
          stripe_coupon_filleul: null,
          statut: 'pending',
        })
        .select('*')
        .single()

      if (error2) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de créer le code Brigade',
        })
      }

      return created2 as Referral
    }

    return created as Referral
  }),

  /**
   * Statistiques de parrainage pour le restaurant connecté.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const { data: referrals } = await (ctx.supabase.from as AnyTable)('referrals')
      .select('*')
      .eq('parrain_restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })

    const list = (referrals ?? []) as Referral[]

    const total_parrainages = list.filter((r) =>
      ['converted', 'credited'].includes(r.statut)
    ).length

    const credits_gagnes = list.filter((r) => r.statut === 'credited').length

    return {
      total_parrainages,
      credits_gagnes,
      referrals: list,
    }
  }),

  /**
   * Vérifie si un code Brigade est valide (pour la page inscription filleul).
   */
  validateCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { data } = await (ctx.supabase.from as AnyTable)('referrals')
        .select('id, code, statut')
        .eq('code', input.code.toUpperCase())
        .maybeSingle()

      if (!data) {
        return { valid: false, message: 'Code introuvable' }
      }

      return { valid: true, code: data.code as string }
    }),

  /**
   * Applique le coupon filleul au restaurant connecté.
   * Met à jour statut → 'registered' et enregistre le filleul_restaurant_id.
   */
  applyCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const normalizedCode = input.code.toUpperCase()

      // Vérifie que le restaurant n'a pas déjà utilisé un code
      const { data: alreadyUsed } = await (ctx.supabase.from as AnyTable)('referrals')
        .select('id')
        .eq('filleul_restaurant_id', ctx.restaurantId)
        .maybeSingle()

      if (alreadyUsed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vous avez déjà utilisé un code de parrainage',
        })
      }

      // Récupère le referral
      const { data: referral } = await (ctx.supabase.from as AnyTable)('referrals')
        .select('*')
        .eq('code', normalizedCode)
        .maybeSingle()

      if (!referral) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Code de parrainage introuvable' })
      }

      const r = referral as Referral

      // Empêche l'auto-parrainage
      if (r.parrain_restaurant_id === ctx.restaurantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vous ne pouvez pas utiliser votre propre code',
        })
      }

      // Récupère l'email filleul
      const filleulEmail = ctx.user.email ?? null

      // Applique le coupon Stripe filleul si disponible
      if (r.stripe_coupon_filleul) {
        try {
          const { stripe } = await import('@/lib/stripe')
          if (stripe) {
            // Récupère le customer Stripe du filleul si déjà abonné
            const { data: sub } = await (ctx.supabase.from as AnyTable)('subscriptions')
              .select('stripe_customer_id')
              .eq('restaurant_id', ctx.restaurantId)
              .maybeSingle()

            if (sub?.stripe_customer_id) {
              await stripe.customers.update(sub.stripe_customer_id, {
                coupon: r.stripe_coupon_filleul,
                metadata: { referral_code: normalizedCode },
              })
            }
          }
        } catch {
          // Stripe non configuré — on ignore
        }
      }

      // Met à jour le referral
      await (ctx.supabase.from as AnyTable)('referrals')
        .update({
          filleul_restaurant_id: ctx.restaurantId,
          filleul_email: filleulEmail,
          statut: 'registered',
        })
        .eq('id', r.id)

      return { success: true, message: '1 mois offert appliqué à votre abonnement !' }
    }),
})
