import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { claudeMatchIngredients } from '@/lib/ai/ingredient-matcher'

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

// Garantit qu'un ingredient_id existe toujours avant l'INSERT fiche_technique.
// Si ingredient_id est fourni, le retourne tel quel.
// Sinon, SELECT existing ou INSERT dans restaurant_ingredients.
async function resolveIngredientId(
  supabase: SupabaseClient,
  restaurantId: string,
  ing: { ingredient_id?: string; nom: string; allergenes?: string[] }
): Promise<string> {
  if (ing.ingredient_id) return ing.ingredient_id

  // 1. Cherche un ingrédient existant avec ce nom (non supprimé)
  const { data: existing } = await supabase
    .from('restaurant_ingredients')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('nom_custom', ing.nom)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (existing) return existing.id

  // 2. Crée l'ingrédient s'il n'existe pas
  const { data, error } = await supabase
    .from('restaurant_ingredients')
    .insert({
      restaurant_id: restaurantId,
      nom_custom: ing.nom,
      allergenes_override: ing.allergenes ?? [],
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Impossible de créer l'ingrédient: ${ing.nom}`)

  return data.id
}

// Fetch les allergènes réels depuis la DB pour une liste d'ingredient_ids.
// allergenes_override prioritaire sur le catalogue.
async function fetchAllergenesForIds(
  supabase: SupabaseClient,
  ingredientIds: string[]
): Promise<string[]> {
  if (!ingredientIds.length) return []
  const { data } = await supabase
    .from('restaurant_ingredients')
    .select('allergenes_override, catalog:ingredients_catalog(allergenes)')
    .in('id', ingredientIds)
  const set = new Set<string>()
  ;(data ?? []).forEach((row) => {
    // Supabase types the join result as array | object depending on relationship type
    const catalog = row.catalog as { allergenes: string[] } | { allergenes: string[] }[] | null
    const catalogAllergenes = Array.isArray(catalog)
      ? (catalog[0]?.allergenes ?? [])
      : (catalog?.allergenes ?? [])
    const allergs: string[] =
      (row.allergenes_override?.length ?? 0) > 0 ? row.allergenes_override! : catalogAllergenes
    allergs.forEach((a: string) => set.add(a))
  })
  return Array.from(set)
}

export interface IngredientLinkSuggestion {
  from_ingredient_id: string
  from_nom: string
  to_ingredient_id: string
  to_nom: string
  confidence: number
}

// Après insertion des fiches, cherche les ingrédients sans prix dans la mercuriale
// et propose des liens via Claude avec les ingrédients mercuriale existants.
async function findMercurialeLinks(
  supabase: SupabaseClient,
  restaurantId: string,
  newIngredients: { id: string; nom: string }[]
): Promise<IngredientLinkSuggestion[]> {
  if (newIngredients.length === 0) return []

  // Ingrédients qui ont déjà un prix actif en mercuriale
  const { data: withPrices } = await supabase
    .from('mercuriale')
    .select('ingredient_id, restaurant_ingredients!inner(id, nom_custom)')
    .eq('restaurant_id', restaurantId)
    .eq('est_actif', true)

  if (!withPrices?.length) return []

  const mercurialeIngredients = withPrices
    .map((row) => {
      const ri = Array.isArray(row.restaurant_ingredients)
        ? row.restaurant_ingredients[0]
        : row.restaurant_ingredients
      return ri ? { id: ri.id as string, nom: ri.nom_custom as string } : null
    })
    .filter(Boolean) as { id: string; nom: string }[]

  // Exclure les ingrédients qui sont déjà dans la mercuriale
  const newWithoutPrice = newIngredients.filter(
    (n) => !mercurialeIngredients.some((m) => m.id === n.id)
  )
  if (newWithoutPrice.length === 0) return []

  const suggestions = await claudeMatchIngredients(
    newWithoutPrice.map((n) => n.nom),
    mercurialeIngredients
  )

  return suggestions.map((s) => {
    const source = newWithoutPrice.find((n) => n.nom === s.designation)!
    return {
      from_ingredient_id: source.id,
      from_nom: source.nom,
      to_ingredient_id: s.ingredient_id,
      to_nom: s.ingredient_nom,
      confidence: s.confidence,
    }
  })
}

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

      // Résoudre les ingredient_id AVANT de calculer les allergènes (source de vérité = DB)
      const resolvedIds = await Promise.all(
        ingredients.map((ing) => resolveIngredientId(ctx.supabase, ctx.restaurantId, ing))
      )

      // Calculer allergènes depuis la DB (pas depuis le client qui peut envoyer [])
      const allergenes = await fetchAllergenesForIds(ctx.supabase, resolvedIds)

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
        ingredient_id: resolvedIds[index],
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
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i]
        if (!ing.prix_achat || !ing.fournisseur_id) continue
        const ingredientId = resolvedIds[i]

        // Désactiver l'ancien prix actif pour cet ingrédient
        await ctx.supabase
          .from('mercuriale')
          .update({ est_actif: false })
          .eq('ingredient_id', ingredientId)
          .eq('est_actif', true)

        // Insérer le nouveau prix actif
        await ctx.supabase.from('mercuriale').insert({
          restaurant_id: ctx.restaurantId,
          ingredient_id: ingredientId,
          fournisseur_id: ing.fournisseur_id,
          prix: ing.prix_achat,
          unite: ing.unite_achat ?? 'kg',
          est_actif: true,
          date_maj: new Date().toISOString(),
        })
      }

      // INSERT fiche_technique_versions (snapshot initial)
      await ctx.supabase.from('fiche_technique_versions').insert({
        plat_id: platData.id,
        version_number: 1,
        ingredients_snapshot: { plat, ingredients, allergenes },
        modifie_par: ctx.user.id,
      })

      // Suggestions IA : lier les nouveaux ingrédients sans prix à la mercuriale existante
      const newIngredients = ingredients.map((ing, i) => ({
        id: resolvedIds[i],
        nom: ing.nom,
      }))
      const aiSuggestions = await findMercurialeLinks(
        ctx.supabase,
        ctx.restaurantId,
        newIngredients
      )

      return { plat_id: platData.id, ai_suggestions: aiSuggestions }
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

      if (ingredients) {
        // Résoudre les ingredient_id avant suppression/réinsertion
        const resolvedIds = await Promise.all(
          ingredients.map((ing) => resolveIngredientId(ctx.supabase, ctx.restaurantId, ing))
        )

        // Calculer allergènes depuis la DB (source de vérité, pas le client)
        const allergenes = await fetchAllergenesForIds(ctx.supabase, resolvedIds)

        // Mettre à jour le plat avec les nouvelles infos + allergènes recalculés
        await ctx.supabase
          .from('plats')
          .update({ ...(plat ?? {}), allergenes })
          .eq('id', platId)

        // Remplacer toutes les lignes fiche_technique
        await ctx.supabase
          .from('fiche_technique')
          .delete()
          .eq('plat_id', platId)
          .eq('restaurant_id', ctx.restaurantId)
        const lignes = ingredients.map((ing, index) => ({
          restaurant_id: ctx.restaurantId,
          plat_id: platId,
          ingredient_id: resolvedIds[index],
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
          ingredients_snapshot: { plat, ingredients, allergenes },
          modifie_par: ctx.user.id,
        })
      } else if (plat) {
        // Mise à jour des métadonnées du plat uniquement (sans toucher aux ingredients/allergènes)
        await ctx.supabase.from('plats').update(plat).eq('id', platId)
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

          const resolvedIds = await Promise.all(
            plat.ingredients.map((ing) =>
              resolveIngredientId(ctx.supabase, ctx.restaurantId, { nom: ing.nom })
            )
          )
          const lignes = plat.ingredients.map((ing, i) => ({
            restaurant_id: ctx.restaurantId,
            plat_id: platData.id,
            ingredient_id: resolvedIds[i],
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

  // Relie un ingrédient fiche (sans mercuriale) à un ingrédient existant qui a un prix.
  // Met à jour toutes les lignes fiche_technique du plat concerné, puis supprime l'orphelin.
  linkIngredient: protectedProcedure
    .input(
      z.object({
        plat_id: z.string().uuid(),
        from_ingredient_id: z.string().uuid(),
        to_ingredient_id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { plat_id, from_ingredient_id, to_ingredient_id } = input

      // Vérifier ownership du plat
      const { data: plat } = await ctx.supabase
        .from('plats')
        .select('id')
        .eq('id', plat_id)
        .eq('restaurant_id', ctx.restaurantId)
        .single()
      if (!plat) throw new Error('Plat non trouvé')

      // Remplacer l'ingredient_id sur les lignes de CE plat uniquement
      const { error } = await ctx.supabase
        .from('fiche_technique')
        .update({ ingredient_id: to_ingredient_id })
        .eq('plat_id', plat_id)
        .eq('ingredient_id', from_ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
      if (error) throw new Error(error.message)

      // Supprimer l'ingrédient orphelin s'il n'est plus référencé nulle part
      const { count } = await ctx.supabase
        .from('fiche_technique')
        .select('id', { count: 'exact', head: true })
        .eq('ingredient_id', from_ingredient_id)

      if (count === 0) {
        await ctx.supabase
          .from('restaurant_ingredients')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', from_ingredient_id)
          .eq('restaurant_id', ctx.restaurantId)
      }

      return { success: true }
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
