import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubTable = any

interface Subscription {
  id: string
  restaurant_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  plan: 'starter' | 'pro' | 'multi'
  statut: string
  trial_end: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export const stripeRouter = router({
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (ctx.supabase.from as SubTable)('subscriptions')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .in('statut', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return (data as Subscription | null) ?? null
  }),

  getPlanLimits: protectedProcedure.query(async ({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (ctx.supabase.rpc as any)('get_plan_limits', {
      p_restaurant_id: ctx.restaurantId,
    })
    return (data as Record<string, unknown>) ?? { max_plats: 3, max_fournisseurs: 1, pms: false }
  }),

  createPortalSession: protectedProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (ctx.supabase.from as SubTable)('subscriptions')
        .select('stripe_customer_id')
        .eq('restaurant_id', ctx.restaurantId)
        .maybeSingle()

      const subData = sub as { stripe_customer_id: string | null } | null
      if (!subData?.stripe_customer_id) throw new Error('Aucun abonnement Stripe trouvé')

      const { stripe } = await import('@/lib/stripe')
      if (!stripe) throw new Error('Stripe non configuré')

      const session = await stripe.billingPortal.sessions.create({
        customer: subData.stripe_customer_id,
        return_url: input.returnUrl,
      })

      return { url: session.url }
    }),
})
