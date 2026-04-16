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

  createIngredient: protectedProcedure
    .input(z.object({ nom: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      // Vérifie si un ingrédient avec ce nom existe déjà (évite les doublons)
      const { data: existing } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('nom_custom', input.nom.trim())
        .is('deleted_at', null)
        .limit(1)
        .single()
      if (existing) return { id: existing.id }

      const { data, error } = await ctx.supabase
        .from('restaurant_ingredients')
        .insert({ restaurant_id: ctx.restaurantId, nom_custom: input.nom.trim() })
        .select('id')
        .single()
      if (error || !data) throw new Error(`Impossible de créer l'ingrédient: ${error?.message}`)
      return { id: data.id }
    }),

  setMercurialePrice: protectedProcedure
    .input(
      z.object({
        ingredient_id: z.string().uuid(),
        fournisseur_id: z.string().uuid().nullable().optional(),
        prix: z.number().positive(),
        unite: z.string().min(1).max(20).default('kg'),
        unite_commande: z.string().max(50).optional(),
        colisage: z.number().positive().optional(),
        reference_fournisseur: z.string().max(100).optional(),
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
          restaurant_id: ctx.restaurantId,
          ingredient_id: input.ingredient_id,
          fournisseur_id: input.fournisseur_id ?? null,
          prix: input.prix,
          unite: input.unite,
          unite_commande: input.unite_commande ?? null,
          colisage: input.colisage ?? null,
          reference_fournisseur: input.reference_fournisseur ?? null,
          est_actif: true,
          date_maj: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  deleteMercurialePrice: protectedProcedure
    .input(z.object({ ingredient_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier que l'ingrédient appartient à ce restaurant
      const { data: ingredient } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('id', input.ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
        .is('deleted_at', null)
        .single()

      if (!ingredient) throw new Error('Ingrédient introuvable ou non autorisé')

      // Désactiver tous les prix actifs — l'ingrédient repasse en "prix manquant"
      await ctx.supabase
        .from('mercuriale')
        .update({ est_actif: false })
        .eq('ingredient_id', input.ingredient_id)
        .eq('est_actif', true)

      return { success: true }
    }),

  maskIngredientMercuriale: protectedProcedure
    .input(z.object({ ingredient_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('restaurant_ingredients')
        .update({ masque_mercuriale: true })
        .eq('id', input.ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
        .is('deleted_at', null)

      if (error) throw new Error(error.message)
      return { success: true }
    }),

  deleteRestaurantIngredient: protectedProcedure
    .input(z.object({ ingredient_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Vérifier appartenance au restaurant
      const { data: ingredient } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('id', input.ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
        .is('deleted_at', null)
        .single()

      if (!ingredient) throw new Error('Ingrédient introuvable ou non autorisé')

      // Soft-delete — les FK avec ON DELETE CASCADE nettoient fiche_technique + mercuriale
      const { error } = await ctx.supabase
        .from('restaurant_ingredients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.ingredient_id)

      if (error) throw new Error(error.message)
      return { success: true }
    }),

  getAllIngredientsMercuriale: protectedProcedure.query(async ({ ctx }) => {
    // 1. Tous les ingrédients visibles du restaurant (non supprimés, non masqués)
    const { data: ingredients } = await ctx.supabase
      .from('restaurant_ingredients')
      .select(
        `
        id, nom_custom, deleted_at, masque_mercuriale,
        catalog:ingredients_catalog(nom, unite_standard)
      `
      )
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null)
      .eq('masque_mercuriale', false)
      .order('nom_custom')

    if (!ingredients?.length) return []

    const ingredientIds = ingredients.map((i) => i.id)

    // 2. Prix actifs + nb fiches utilisant chaque ingrédient (en parallèle)
    const [{ data: prix }, { data: fichesCount }] = await Promise.all([
      ctx.supabase
        .from('mercuriale')
        .select(
          'id, prix, unite, unite_commande, colisage, reference_fournisseur, date_maj, ingredient_id, fournisseur:fournisseurs(id, nom)'
        )
        .in('ingredient_id', ingredientIds)
        .eq('est_actif', true),
      ctx.supabase
        .from('fiche_technique')
        .select('ingredient_id')
        .in('ingredient_id', ingredientIds)
        .is('deleted_at', null),
    ])

    // 3. Fournisseurs disponibles
    const { data: fournisseurs } = await ctx.supabase
      .from('fournisseurs')
      .select('id, nom')
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null)
      .order('nom')

    const prixByIngredient = new Map((prix ?? []).map((p) => [p.ingredient_id, p]))

    // Comptage fiches par ingrédient
    const fichesCountMap = new Map<string, number>()
    for (const row of fichesCount ?? []) {
      if (!row.ingredient_id) continue
      fichesCountMap.set(row.ingredient_id, (fichesCountMap.get(row.ingredient_id) ?? 0) + 1)
    }

    return ingredients.map((ing) => {
      const catalog = ing.catalog as { nom: string; unite_standard: string | null } | null
      const prix_actif = prixByIngredient.get(ing.id) ?? null
      const fournisseur_actif =
        (prix_actif?.fournisseur as { id: string; nom: string } | null) ?? null
      return {
        ingredient_id: ing.id,
        nom: ing.nom_custom ?? catalog?.nom ?? '—',
        unite_standard: catalog?.unite_standard ?? 'kg',
        mercuriale_id: prix_actif?.id ?? null,
        prix: prix_actif?.prix ?? null,
        unite: prix_actif?.unite ?? catalog?.unite_standard ?? 'kg',
        unite_commande: prix_actif?.unite_commande ?? null,
        colisage: prix_actif?.colisage ?? null,
        reference_fournisseur: prix_actif?.reference_fournisseur ?? null,
        date_maj: prix_actif?.date_maj ?? null,
        fournisseur: fournisseur_actif,
        fournisseurs_disponibles: fournisseurs ?? [],
        fiches_count: fichesCountMap.get(ing.id) ?? 0,
      }
    })
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

  // ═══════════════════════════════════════════
  // COMMANDE AUTO — suggestion basée ventes + recettes
  // ═══════════════════════════════════════════

  suggestCommande: protectedProcedure
    .input(z.object({ jours: z.number().int().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setDate(dateDebut.getDate() - input.jours)
      const dateFin = new Date().toISOString().split('T')[0]

      // 1. Ventes sur la période
      const { data: ventes } = await ctx.supabase
        .from('ventes')
        .select('plat_id, quantite')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date', dateDebut.toISOString().split('T')[0])
        .lte('date', dateFin)
        .not('plat_id', 'is', null)

      if (!ventes || ventes.length === 0) {
        return { suggestions: [], jours: input.jours, nb_plats: 0 }
      }

      // Agréger quantités vendues par plat
      const platQuantites = new Map<string, number>()
      for (const v of ventes) {
        if (!v.plat_id) continue
        platQuantites.set(v.plat_id, (platQuantites.get(v.plat_id) ?? 0) + (v.quantite ?? 1))
      }

      const platIds = Array.from(platQuantites.keys())

      // 2. Fiches techniques pour ces plats
      const { data: lignesFiches } = await ctx.supabase
        .from('fiche_technique')
        .select(
          `plat_id, grammage, unite, fournisseur_id_habituel,
           ingredient:restaurant_ingredients(id, nom_custom, catalog:ingredients_catalog(nom))`
        )
        .in('plat_id', platIds)
        .eq('restaurant_id', ctx.restaurantId)
        .not('ingredient_id', 'is', null)
        .is('deleted_at', null)

      if (!lignesFiches || lignesFiches.length === 0) {
        return { suggestions: [], jours: input.jours, nb_plats: platIds.length }
      }

      // 3. Mercuriale pour les ingrédients (fournisseur + prix)
      const ingredientIds = Array.from(
        new Set(
          lignesFiches
            .map((l) => (l.ingredient as unknown as { id: string } | null)?.id)
            .filter(Boolean) as string[]
        )
      )

      const { data: mercuriale } =
        ingredientIds.length > 0
          ? await ctx.supabase
              .from('mercuriale')
              .select(
                'ingredient_id, fournisseur_id, prix, unite, fournisseur:fournisseurs(id, nom)'
              )
              .in('ingredient_id', ingredientIds)
              .eq('est_actif', true)
          : { data: [] }

      const mercurialeMap = new Map((mercuriale ?? []).map((m) => [m.ingredient_id, m]))

      // 3.5 Stock actuel (dernier inventaire par ingrédient)
      // inventaire_reel n'est pas encore dans les types Supabase générés — cast any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAny = ctx.supabase as any
      let stockRows: Array<{ ingredient_id: string; quantite: number; date: string }> = []
      if (ingredientIds.length > 0) {
        const { data } = (await dbAny
          .from('inventaire_reel')
          .select('ingredient_id, quantite, date')
          .in('ingredient_id', ingredientIds)
          .eq('restaurant_id', ctx.restaurantId)
          .order('date', { ascending: false })) as {
          data: Array<{ ingredient_id: string; quantite: number; date: string }> | null
        }
        stockRows = data ?? []
      }

      const stockMap = new Map<string, number>()
      for (const row of stockRows ?? []) {
        if (row.ingredient_id && !stockMap.has(row.ingredient_id)) {
          stockMap.set(row.ingredient_id, row.quantite)
        }
      }

      // 4. Calculer les besoins : quantite_vendue × grammage (convertit g→kg si unite=g), déduit le stock
      const besoins = new Map<
        string,
        {
          ingredient_id: string
          nom: string
          quantite_totale: number
          stock_actuel: number
          unite: string
          prix_unitaire: number | null
          fournisseur_id: string | null
          fournisseur_nom: string | null
        }
      >()

      for (const ligne of lignesFiches) {
        const ing = ligne.ingredient as unknown as {
          id: string
          nom_custom: string | null
          catalog: { nom: string } | null
        } | null
        if (!ing) continue
        const qteVendue = platQuantites.get(ligne.plat_id as string) ?? 0
        if (qteVendue === 0) continue

        const grammage = ligne.grammage ?? 0
        const unite = (ligne.unite as string) ?? 'g'
        // Convertir tout en kg si l'unité est g
        const rawNeed = unite === 'g' ? (grammage * qteVendue) / 1000 : grammage * qteVendue
        const uniteFinale = unite === 'g' ? 'kg' : unite

        const merc = mercurialeMap.get(ing.id)
        const fournisseurId =
          (ligne.fournisseur_id_habituel as string | null) ?? merc?.fournisseur_id ?? null
        const fournisseurNom = (merc?.fournisseur as { nom: string } | null)?.nom ?? null

        const nom = ing.nom_custom ?? ing.catalog?.nom ?? 'Ingrédient'
        const stock = stockMap.get(ing.id) ?? 0

        const existing = besoins.get(ing.id)
        if (existing) {
          existing.quantite_totale += rawNeed
        } else {
          besoins.set(ing.id, {
            ingredient_id: ing.id,
            nom,
            quantite_totale: rawNeed,
            stock_actuel: stock,
            unite: uniteFinale,
            prix_unitaire: merc?.prix ?? null,
            fournisseur_id: fournisseurId,
            fournisseur_nom: fournisseurNom,
          })
        }
      }

      // 5. Grouper par fournisseur
      const parFournisseur = new Map<
        string,
        {
          fournisseur_id: string | null
          fournisseur_nom: string
          lignes: typeof besoins extends Map<string, infer V> ? V[] : never[]
        }
      >()

      for (const besoin of Array.from(besoins.values())) {
        // Soustraire le stock et arrondir au dixième supérieur
        const quantiteNette = Math.max(0, besoin.quantite_totale - besoin.stock_actuel)
        const quantiteArrondie = Math.ceil(quantiteNette * 10) / 10
        // Ignorer les ingrédients déjà couverts par le stock
        if (quantiteArrondie === 0) continue

        const key = besoin.fournisseur_id ?? '__sans_fournisseur__'
        const label = besoin.fournisseur_nom ?? 'Sans fournisseur'
        if (!parFournisseur.has(key)) {
          parFournisseur.set(key, {
            fournisseur_id: besoin.fournisseur_id,
            fournisseur_nom: label,
            lignes: [],
          })
        }
        parFournisseur.get(key)!.lignes.push({
          ...besoin,
          quantite_totale: quantiteArrondie,
        })
      }

      return {
        suggestions: Array.from(parFournisseur.values()) as Array<{
          fournisseur_id: string | null
          fournisseur_nom: string
          lignes: Array<{
            ingredient_id: string
            nom: string
            quantite_totale: number
            stock_actuel: number
            unite: string
            prix_unitaire: number | null
            fournisseur_id: string | null
            fournisseur_nom: string | null
          }>
        }>,
        jours: input.jours,
        nb_plats: platIds.length,
      }
    }),

  // ═══════════════════════════════════════════
  // INVENTAIRE — saisie et consultation stock
  // ═══════════════════════════════════════════

  'inventaire.list': protectedProcedure.query(async ({ ctx }) => {
    // Tous les ingrédients visibles avec leur prix mercuriale actif (pour l'unité)
    const { data: ingredients } = await ctx.supabase
      .from('restaurant_ingredients')
      .select('id, nom_custom, catalog:ingredients_catalog(nom)')
      .eq('restaurant_id', ctx.restaurantId)
      .is('deleted_at', null)
      .order('nom_custom', { ascending: true })

    if (!ingredients || ingredients.length === 0) return []

    const ids = ingredients.map((i) => i.id)

    // Unité depuis la mercuriale (prix actif)
    const { data: mercRows } = await ctx.supabase
      .from('mercuriale')
      .select('ingredient_id, unite')
      .in('ingredient_id', ids)
      .eq('est_actif', true)

    const uniteMap = new Map((mercRows ?? []).map((m) => [m.ingredient_id, m.unite]))

    // inventaire_reel n'est pas encore dans les types Supabase générés — cast any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.supabase as any
    const { data: stockRows } = (await db
      .from('inventaire_reel')
      .select('ingredient_id, quantite, date')
      .in('ingredient_id', ids)
      .eq('restaurant_id', ctx.restaurantId)
      .order('date', { ascending: false })) as {
      data: Array<{ ingredient_id: string; quantite: number; date: string }> | null
    }

    const lastStock = new Map<string, { quantite: number; date: string }>()
    for (const row of stockRows ?? []) {
      if (row.ingredient_id && !lastStock.has(row.ingredient_id)) {
        lastStock.set(row.ingredient_id, { quantite: row.quantite, date: row.date })
      }
    }

    return ingredients.map((ing) => {
      const cat = ing.catalog as { nom: string } | null
      const stock = lastStock.get(ing.id)
      return {
        ingredient_id: ing.id,
        nom: ing.nom_custom ?? cat?.nom ?? 'Ingrédient',
        unite: uniteMap.get(ing.id) ?? 'kg',
        quantite_actuelle: stock?.quantite ?? null,
        date_inventaire: stock?.date ?? null,
      }
    })
  }),

  'inventaire.save': protectedProcedure
    .input(
      z.object({
        lignes: z
          .array(
            z.object({
              ingredient_id: z.string().uuid(),
              quantite: z.number().min(0),
              unite: z.string().min(1).max(20),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const today = new Date().toISOString().split('T')[0]
      const rows = input.lignes.map((l) => ({
        restaurant_id: ctx.restaurantId,
        ingredient_id: l.ingredient_id,
        quantite: l.quantite,
        unite: l.unite,
        date: today,
        auteur_id: ctx.user.id,
      }))
      // inventaire_reel n'est pas encore dans les types Supabase générés — cast any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.supabase as any
      const { error } = (await db.from('inventaire_reel').insert(rows)) as {
        error: { message: string } | null
      }
      if (error) throw new Error(error.message)
      return { saved: rows.length }
    }),
})
