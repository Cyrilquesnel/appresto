import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const ingredientsRouter = router({
  // Phase 2 — Deduplication

  detectDuplicates: protectedProcedure
    .input(z.object({ threshold: z.number().min(0.5).max(1).default(0.65) }))
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (ctx.supabase as any).rpc('detect_ingredient_duplicates', {
        p_restaurant_id: ctx.restaurantId,
        p_threshold: input.threshold,
      })
      if (error) throw new Error((error as { message: string }).message)
      return (data ?? []) as {
        id_a: string
        nom_a: string
        id_b: string
        nom_b: string
        score: number
      }[]
    }),

  mergeIngredients: protectedProcedure
    .input(
      z.object({
        winner_id: z.string().uuid(),
        loser_id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (ctx.supabase as any).rpc('merge_ingredients', {
        p_winner_id: input.winner_id,
        p_loser_id: input.loser_id,
        p_user_id: ctx.user.id,
      })
      if (error) throw new Error((error as { message: string }).message)
    }),

  // Phase 3 — Supplier mapping

  confirmMapping: protectedProcedure
    .input(
      z.object({
        ingredient_id: z.string().uuid(),
        fournisseur_id: z.string().uuid().optional(),
        designation_raw: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (ctx.supabase as any).from('ingredient_supplier_mappings').upsert(
        {
          restaurant_id: ctx.restaurantId,
          ingredient_id: input.ingredient_id,
          fournisseur_id: input.fournisseur_id ?? null,
          designation_raw: input.designation_raw.toLowerCase().trim(),
          confirmed_by: ctx.user.id,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'restaurant_id,fournisseur_id,designation_raw' }
      )
      if (error) throw new Error((error as { message: string }).message)
    }),

  getMappings: protectedProcedure.query(async ({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (ctx.supabase as any)
      .from('ingredient_supplier_mappings')
      .select('id, designation_raw, ingredient_id, fournisseur_id, usage_count, confirmed_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('usage_count', { ascending: false })
    return (data ?? []) as {
      id: string
      designation_raw: string
      ingredient_id: string
      fournisseur_id: string | null
      usage_count: number
      confirmed_at: string
    }[]
  }),
})
