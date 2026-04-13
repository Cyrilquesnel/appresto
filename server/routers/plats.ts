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
    .input(z.object({
      query: z.string().min(1).max(100),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .rpc('search_ingredients', {
          p_query: input.query,
          p_restaurant_id: ctx.restaurantId,
          p_limit: input.limit,
        })
      return data ?? []
    }),
})
