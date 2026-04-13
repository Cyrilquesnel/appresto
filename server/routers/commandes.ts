import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const commandesRouter = router({
  // ═══════════════════════════════════════════
  // FOURNISSEURS
  // ═══════════════════════════════════════════

  createFournisseur: protectedProcedure
    .input(
      z.object({
        nom: z.string().min(1).max(200),
        contact_nom: z.string().optional(),
        contact_tel: z.string().optional(),
        contact_whatsapp: z.string().optional(), // format international: +33612345678
        contact_email: z.string().email().optional(),
        delai_jours: z.number().int().min(0).max(30).default(2),
        min_commande: z.number().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('fournisseurs')
        .insert({ ...input, restaurant_id: ctx.restaurantId })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  listFournisseurs: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('fournisseurs')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null)
      .order('nom')
    return data ?? []
  }),

  updateFournisseur: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nom: z.string().min(1).optional(),
        contact_nom: z.string().optional(),
        contact_tel: z.string().optional(),
        contact_whatsapp: z.string().optional(),
        contact_email: z.string().email().optional(),
        delai_jours: z.number().int().min(0).max(30).optional(),
        min_commande: z.number().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      await ctx.supabase
        .from('fournisseurs')
        .update(rest)
        .eq('id', id)
        .eq('restaurant_id', ctx.restaurantId)
      return { success: true }
    }),

  deleteFournisseur: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('fournisseurs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('restaurant_id', ctx.restaurantId)
      return { success: true }
    }),

  // ═══════════════════════════════════════════
  // MERCURIALE
  // ═══════════════════════════════════════════

  setMercurialePrice: protectedProcedure
    .input(
      z.object({
        ingredient_id: z.string().uuid(),
        fournisseur_id: z.string().uuid(),
        prix: z.number().positive(),
        unite: z.string().min(1).max(20).default('kg'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'ingrédient appartient bien à ce restaurant
      const { data: ingredient, error: ingError } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('id', input.ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
        .is('deleted_at', null)
        .single()

      if (ingError || !ingredient) {
        throw new Error('Ingrédient introuvable ou non autorisé')
      }

      // Désactiver l'ancien prix actif pour cet ingrédient
      await ctx.supabase
        .from('mercuriale')
        .update({ est_actif: false })
        .eq('ingredient_id', input.ingredient_id)
        .eq('est_actif', true)

      // Insérer le nouveau prix (actif) — déclenche trigger cascade (Task 2.5)
      const { data, error } = await ctx.supabase
        .from('mercuriale')
        .insert({
          ingredient_id: input.ingredient_id,
          fournisseur_id: input.fournisseur_id,
          prix: input.prix,
          unite: input.unite,
          est_actif: true,
          date_maj: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  getMercuriale: protectedProcedure.query(async ({ ctx }) => {
    // mercuriale n'a pas de restaurant_id → filtrer via restaurant_ingredients
    const { data: ings } = await ctx.supabase
      .from('restaurant_ingredients')
      .select('id')
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null)

    if (!ings?.length) return []

    const ingredientIds = ings.map((i) => i.id)

    const { data } = await ctx.supabase
      .from('mercuriale')
      .select(
        `id, prix, unite, date_maj,
         ingredient:restaurant_ingredients(id, nom_custom, catalog:ingredients_catalog(nom)),
         fournisseur:fournisseurs(id, nom)`
      )
      .in('ingredient_id', ingredientIds)
      .eq('est_actif', true)
      .order('date_maj', { ascending: false })

    return data ?? []
  }),

  getMercurialeHistory: protectedProcedure
    .input(z.object({ ingredientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Vérifier que l'ingrédient appartient à ce restaurant
      const { data: ingredient } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('id', input.ingredientId)
        .eq('restaurant_id', ctx.restaurantId)
        .is('deleted_at', null)
        .single()

      if (!ingredient) return []

      const { data } = await ctx.supabase
        .from('mercuriale')
        .select('prix, unite, date_maj, fournisseur:fournisseurs(nom)')
        .eq('ingredient_id', input.ingredientId)
        .order('date_maj', { ascending: false })
        .limit(10)

      return data ?? []
    }),

  // ═══════════════════════════════════════════
  // BONS DE COMMANDE
  // ═══════════════════════════════════════════

  generateBonDeCommande: protectedProcedure
    .input(
      z.object({
        fournisseur_id: z.string().uuid(),
        date_livraison_souhaitee: z.string().optional(),
        notes: z.string().optional(),
        lignes: z
          .array(
            z.object({
              ingredient_id: z.string().uuid(),
              quantite: z.number().positive(),
              unite: z.string().min(1).max(20),
              prix_unitaire: z.number().positive().optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fournisseur_id, date_livraison_souhaitee, notes, lignes } = input

      // Calculer total_ht — si prix_unitaire absent, chercher dans mercuriale
      let total_ht = 0
      const lignesAvecPrix = await Promise.all(
        lignes.map(async (ligne) => {
          let prix = ligne.prix_unitaire ?? 0
          if (!prix) {
            const { data: merc } = await ctx.supabase
              .from('mercuriale')
              .select('prix')
              .eq('ingredient_id', ligne.ingredient_id)
              .eq('est_actif', true)
              .single()
            prix = merc?.prix ?? 0
          }
          total_ht += ligne.quantite * prix
          return { ...ligne, prix_unitaire: prix }
        })
      )
      total_ht = Math.round(total_ht * 100) / 100

      const { data: bon, error: bonError } = await ctx.supabase
        .from('bons_de_commande')
        .insert({
          restaurant_id: ctx.restaurantId,
          fournisseur_id,
          date_livraison_souhaitee: date_livraison_souhaitee || null,
          notes: notes || null,
          total_ht,
          statut: 'brouillon',
        })
        .select('id')
        .single()

      if (bonError || !bon) throw new Error(bonError?.message ?? 'Erreur création bon')

      await ctx.supabase.from('bon_de_commande_lignes').insert(
        lignesAvecPrix.map((l, i) => ({
          bon_id: bon.id,
          ingredient_id: l.ingredient_id,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire || null,
          total_ligne: l.prix_unitaire
            ? Math.round(l.quantite * l.prix_unitaire * 100) / 100
            : null,
          ordre: i,
        }))
      )

      return { bon_id: bon.id }
    }),

  listBons: protectedProcedure
    .input(
      z
        .object({
          statut: z.enum(['brouillon', 'envoye', 'confirme', 'recu']).optional(),
          fournisseur_id: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('bons_de_commande')
        .select(
          `id, statut, total_ht, date_livraison_souhaitee, envoye_via, created_at,
           fournisseur:fournisseurs(id, nom, contact_whatsapp, contact_email)`
        )
        .eq('restaurant_id', ctx.restaurantId)
        .order('created_at', { ascending: false })

      if (input?.statut) query = query.eq('statut', input.statut)
      if (input?.fournisseur_id) query = query.eq('fournisseur_id', input.fournisseur_id)

      const { data } = await query
      return data ?? []
    }),

  getBon: protectedProcedure
    .input(z.object({ bonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('bons_de_commande')
        .select(
          `*, fournisseur:fournisseurs(*),
           lignes:bon_de_commande_lignes(
             id, quantite, unite, prix_unitaire, total_ligne, ordre,
             ingredient:restaurant_ingredients(id, nom_custom, catalog:ingredients_catalog(nom))
           )`
        )
        .eq('id', input.bonId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()
      return data ?? null
    }),

  updateStatutBon: protectedProcedure
    .input(
      z.object({
        bonId: z.string().uuid(),
        statut: z.enum(['brouillon', 'envoye', 'confirme', 'recu']),
        envoye_via: z.enum(['whatsapp', 'email', 'pdf']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('bons_de_commande')
        .update({
          statut: input.statut,
          envoye_via: input.envoye_via ?? null,
        })
        .eq('id', input.bonId)
        .eq('restaurant_id', ctx.restaurantId)
      return { success: true }
    }),
})
