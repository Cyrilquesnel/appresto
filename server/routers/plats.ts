import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const platsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('plats')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
    return data ?? []
  }),

  searchIngredients: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (ctx.supabase as any)
        .rpc('search_ingredients', {
          p_query: input.query,
          p_restaurant_id: ctx.restaurantId,
          p_limit: input.limit,
        })
      return data ?? []
    }),
})
