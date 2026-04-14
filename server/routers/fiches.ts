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
  fournisseur_id: z.string().uuid().optional(),
  prix_achat: z.number().positive().optional(),
  unite_achat: z.string().optional(),
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

      const { error: fichesError } = await ctx.supabase.from('fiche_technique').insert(lignes)

      if (fichesError) {
        throw new Error(`Erreur création fiche: ${fichesError.message}`)
      }

      // Upsert mercuriale pour tous les ingrédients avec prix_achat + fournisseur_id
      for (const ing of ingredients) {
        if (!ing.prix_achat || !ing.fournisseur_id) continue

        let ingredientId = ing.ingredient_id

        // Si l'ingrédient n'est pas encore dans restaurant_ingredients, on le crée
        if (!ingredientId) {
          const { data: newIng } = await ctx.supabase
            .from('restaurant_ingredients')
            .insert({
              restaurant_id: ctx.restaurantId,
              nom_custom: ing.nom,
              allergenes_override: ing.allergenes ?? [],
            })
            .select('id')
            .single()
          ingredientId = newIng?.id
        }

        if (ingredientId) {
          // Désactiver l'ancien prix actif pour cet ingrédient
          await ctx.supabase
            .from('mercuriale')
            .update({ est_actif: false })
            .eq('ingredient_id', ingredientId)
            .eq('est_actif', true)

          // Insérer le nouveau prix actif
          await ctx.supabase.from('mercuriale').insert({
            ingredient_id: ingredientId,
            fournisseur_id: ing.fournisseur_id,
            prix: ing.prix_achat,
            unite: ing.unite_achat ?? 'kg',
            est_actif: true,
            date_maj: new Date().toISOString(),
          })
        }
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
        .select(
          `
          *,
          fiche_technique (
            id, nom_ingredient, grammage, unite, ordre,
            ingredient_id, fournisseur_id_habituel
          )
        `
        )
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
        await ctx.supabase
          .from('fiche_technique')
          .delete()
          .eq('plat_id', platId)
          .eq('restaurant_id', ctx.restaurantId)
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    return data ?? []
  }),

  importBulk: protectedProcedure
    .input(
      z.object({
        plats: z.array(
          z.object({
            nom: z.string().min(1),
            prix_vente_ht: z.number().positive().optional(),
            ingredients: z.array(
              z.object({
                nom: z.string().min(1),
                grammage: z.number().positive(),
                unite: z.string().default('g'),
              })
            ),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results: { nom: string; success: boolean; error?: string }[] = []
      for (const plat of input.plats) {
        try {
          const { data: platData, error: platError } = await ctx.supabase
            .from('plats')
            .insert({
              restaurant_id: ctx.restaurantId,
              nom: plat.nom,
              prix_vente_ht: plat.prix_vente_ht ?? null,
              statut: 'brouillon',
            })
            .select('id')
            .single()
          if (platError || !platData) throw new Error(platError?.message ?? 'Erreur création plat')

          const lignes = plat.ingredients.map((ing, i) => ({
            restaurant_id: ctx.restaurantId,
            plat_id: platData.id,
            nom_ingredient: ing.nom,
            grammage: ing.grammage,
            unite: ing.unite,
            ordre: i,
          }))
          const { error: fichesError } = await ctx.supabase.from('fiche_technique').insert(lignes)
          if (fichesError) throw new Error(fichesError.message)

          results.push({ nom: plat.nom, success: true })
        } catch (e) {
          results.push({ nom: plat.nom, success: false, error: (e as Error).message })
        }
      }
      return results
    }),

  archive: protectedProcedure
    .input(z.object({ platId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('plats')
        .update({ statut: 'archive', deleted_at: new Date().toISOString() })
        .eq('id', input.platId)
        .eq('restaurant_id', ctx.restaurantId)
      if (error) throw new Error(error.message)
      return { success: true }
    }),
})
