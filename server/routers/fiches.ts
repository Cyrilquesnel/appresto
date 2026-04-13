import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

const IngredientLineSchema = z.object({
  ingredient_id: z.string().uuid().optional(),
  nom: z.string().min(1),
  grammage: z.number().positive(),
  unite: z.string().min(1).max(20),
  fournisseur_id_habituel: z.string().uuid().optional(),
  allergenes: z.array(z.string()).default([]),
  is_manual: z.boolean().default(false),
})

export const fichesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        plat: z.object({
          nom: z.string().min(1).max(200),
          description: z.string().optional(),
          photo_url: z.string().optional(),
          type_plat: z.string().optional(),
          prix_vente_ht: z.number().positive().optional(),
          statut: z.enum(['brouillon', 'actif']).default('brouillon'),
        }),
        ingredients: z.array(IngredientLineSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { plat, ingredients } = input

      // Calculer allergènes (union de tous les ingrédients)
      const allergenesSet = new Set<string>()
      ingredients.forEach((ing) => ing.allergenes.forEach((a) => allergenesSet.add(a)))
      const allergenes = Array.from(allergenesSet)

      // INSERT plat
      const { data: platData, error: platError } = await ctx.supabase
        .from('plats')
        .insert({
          restaurant_id: ctx.restaurantId,
          nom: plat.nom,
          description: plat.description,
          photo_url: plat.photo_url,
          type_plat: plat.type_plat,
          prix_vente_ht: plat.prix_vente_ht,
          statut: plat.statut,
          allergenes,
        })
        .select('id')
        .single()

      if (platError || !platData) {
        throw new Error(`Erreur création plat: ${platError?.message}`)
      }

      // INSERT fiche_technique lignes
      const lignes = ingredients.map((ing, index) => ({
        restaurant_id: ctx.restaurantId,
        plat_id: platData.id,
        ingredient_id: ing.ingredient_id ?? null,
        nom_ingredient: ing.nom,
        grammage: ing.grammage,
        unite: ing.unite,
        fournisseur_id_habituel: ing.fournisseur_id_habituel ?? null,
        ordre: index,
      }))

      const { error: fichesError } = await ctx.supabase
        .from('fiche_technique')
        .insert(lignes)

      if (fichesError) {
        throw new Error(`Erreur création fiche: ${fichesError.message}`)
      }

      // INSERT fiche_technique_versions (snapshot initial)
      await ctx.supabase.from('fiche_technique_versions').insert({
        plat_id: platData.id,
        version_number: 1,
        ingredients_snapshot: { plat, ingredients, allergenes },
        modifie_par: ctx.user.id,
      })

      return { plat_id: platData.id }
    }),

  get: protectedProcedure
    .input(z.object({ platId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: plat } = await ctx.supabase
        .from('plats')
        .select(`
          *,
          fiche_technique (
            id, nom_ingredient, grammage, unite, ordre,
            ingredient_id, fournisseur_id_habituel
          )
        `)
        .eq('id', input.platId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()

      return plat
    }),

  update: protectedProcedure
    .input(
      z.object({
        platId: z.string().uuid(),
        plat: z
          .object({
            nom: z.string().min(1).max(200).optional(),
            description: z.string().optional(),
            prix_vente_ht: z.number().positive().optional(),
            statut: z.enum(['brouillon', 'actif']).optional(),
          })
          .optional(),
        ingredients: z.array(IngredientLineSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { platId, plat, ingredients } = input

      // Vérifier ownership
      const { data: existing } = await ctx.supabase
        .from('plats')
        .select('id')
        .eq('id', platId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()
      if (!existing) throw new Error('Plat non trouvé')

      if (plat) {
        const allergenesUpdate: Partial<{ allergenes: string[] }> = {}
        if (ingredients) {
          const allergenesSet = new Set<string>()
          ingredients.forEach((ing) => ing.allergenes.forEach((a) => allergenesSet.add(a)))
          allergenesUpdate.allergenes = Array.from(allergenesSet)
        }
        await ctx.supabase
          .from('plats')
          .update({ ...plat, ...allergenesUpdate })
          .eq('id', platId)
      }

      if (ingredients) {
        // Remplacer toutes les lignes fiche_technique
        await ctx.supabase.from('fiche_technique').delete().eq('plat_id', platId)
        const lignes = ingredients.map((ing, index) => ({
          restaurant_id: ctx.restaurantId,
          plat_id: platId,
          ingredient_id: ing.ingredient_id ?? null,
          nom_ingredient: ing.nom,
          grammage: ing.grammage,
          unite: ing.unite,
          ordre: index,
        }))
        await ctx.supabase.from('fiche_technique').insert(lignes)

        // Nouveau snapshot version
        const { count } = await ctx.supabase
          .from('fiche_technique_versions')
          .select('*', { count: 'exact', head: true })
          .eq('plat_id', platId)

        await ctx.supabase.from('fiche_technique_versions').insert({
          plat_id: platId,
          version_number: (count ?? 0) + 1,
          ingredients_snapshot: { plat, ingredients },
          modifie_par: ctx.user.id,
        })
      }

      return { success: true }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('plats')
      .select('id, nom, photo_url, statut, cout_de_revient, allergenes, created_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
    return data ?? []
  }),
})
