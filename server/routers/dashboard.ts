import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

const ServiceEnum = z.enum(['midi', 'soir', 'continu'])
const ModeVentesEnum = z.enum(['simple', 'detail'])

export const dashboardRouter = router({
  // ═══ VENTES ═══
  logVentes: protectedProcedure
    .input(
      z.discriminatedUnion('mode', [
        z.object({
          mode: z.literal('simple'),
          date: z.string(),
          service: ServiceEnum,
          nb_couverts: z.number().int().min(0),
          panier_moyen: z.number().positive(),
          notes: z.string().optional(),
        }),
        z.object({
          mode: z.literal('detail'),
          date: z.string(),
          service: ServiceEnum,
          lignes: z
            .array(
              z.object({
                plat_id: z.string().uuid(),
                quantite: z.number().int().positive(),
                prix_vente: z.number().positive(),
              })
            )
            .min(1),
          notes: z.string().optional(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      if (input.mode === 'simple') {
        const montant = input.nb_couverts * input.panier_moyen
        const { error } = await ctx.supabase.from('ventes').insert({
          restaurant_id: ctx.restaurantId,
          date: input.date,
          service: input.service,
          quantite: input.nb_couverts,
          nb_couverts: input.nb_couverts,
          panier_moyen: input.panier_moyen,
          montant_total: montant,
          plat_id: null,
          mode_saisie: 'simple',
          notes: input.notes ?? null,
        })
        if (error) throw new Error(error.message)
        return { success: true, montant_total: montant }
      } else {
        const insertions = input.lignes.map((l) => ({
          restaurant_id: ctx.restaurantId,
          date: input.date,
          service: input.service,
          plat_id: l.plat_id,
          quantite: l.quantite,
          montant_total: l.quantite * l.prix_vente,
          mode_saisie: 'detail',
          notes: input.notes ?? null,
        }))
        const { error } = await ctx.supabase.from('ventes').insert(insertions)
        if (error) throw new Error(error.message)
        const total = input.lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)
        return { success: true, montant_total: total }
      }
    }),

  getVentes: protectedProcedure
    .input(
      z.object({
        date_debut: z.string(),
        date_fin: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('ventes')
        .select('*, plat:plats(nom)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date', input.date_debut)
        .lte('date', input.date_fin)
        .order('date', { ascending: false })
      return data ?? []
    }),

  // ═══ CHARGES ═══
  saveCharges: protectedProcedure
    .input(
      z.object({
        mois: z.string(),
        masse_salariale: z.number().min(0).optional(),
        loyer: z.number().min(0).optional(),
        energie: z.number().min(0).optional(),
        assurances: z.number().min(0).optional(),
        autres_charges: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { mois, ...charges } = input
      const charges_fixes_total = Object.values(charges).reduce((a: number, b) => a + (b ?? 0), 0)
      await ctx.supabase.from('charges').upsert(
        {
          restaurant_id: ctx.restaurantId,
          mois,
          ...charges,
          charges_fixes_total,
        },
        { onConflict: 'restaurant_id,mois' }
      )
      return { success: true }
    }),

  getCharges: protectedProcedure
    .input(z.object({ mois: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('charges')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('mois', input.mois)
        .single()
      return data
    }),

  // ═══ MODE VENTES ═══
  getModeVentes: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('restaurants')
      .select('parametres')
      .eq('id', ctx.restaurantId)
      .single()
    return (
      ((data?.parametres as Record<string, unknown> | null)?.mode_ventes as 'simple' | 'detail') ??
      'simple'
    )
  }),

  setModeVentes: protectedProcedure
    .input(z.object({ mode: ModeVentesEnum }))
    .mutation(async ({ ctx, input }) => {
      const { data: restaurant } = await ctx.supabase
        .from('restaurants')
        .select('parametres')
        .eq('id', ctx.restaurantId)
        .single()

      await ctx.supabase
        .from('restaurants')
        .update({
          parametres: {
            ...((restaurant?.parametres as Record<string, unknown>) ?? {}),
            mode_ventes: input.mode,
          },
        })
        .eq('id', ctx.restaurantId)
      return { success: true }
    }),

  // ═══ KPIs DASHBOARD ═══
  get: protectedProcedure
    .input(
      z.object({
        periode: z.enum(['mois', 'semaine']).default('mois'),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date()

      let dateDebut: string
      let dateFin: string
      let moisCourant: string

      if (input.periode === 'mois') {
        dateDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        dateFin = now.toISOString().split('T')[0]
        moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      } else {
        const dayOfWeek = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        dateDebut = monday.toISOString().split('T')[0]
        dateFin = now.toISOString().split('T')[0]
        moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      }

      const { data: restaurantIngredients } = await ctx.supabase
        .from('restaurant_ingredients')
        .select('id')
        .eq('restaurant_id', ctx.restaurantId)

      const ingredientIds = restaurantIngredients?.map((r) => r.id) ?? []
      const { count: nb_ingredients_avec_prix } =
        ingredientIds.length > 0
          ? await ctx.supabase
              .from('mercuriale')
              .select('*', { count: 'exact', head: true })
              .in('ingredient_id', ingredientIds)
              .eq('est_actif', true)
          : { count: 0 }

      const [ventesResult, chargesResult, platsResult] = await Promise.all([
        ctx.supabase
          .from('ventes')
          .select('montant_total, nb_couverts, plat_id, quantite')
          .eq('restaurant_id', ctx.restaurantId)
          .gte('date', dateDebut)
          .lte('date', dateFin),
        ctx.supabase
          .from('charges')
          .select('*')
          .eq('restaurant_id', ctx.restaurantId)
          .eq('mois', moisCourant)
          .single(),
        ctx.supabase
          .from('plats')
          .select('id, cout_de_revient')
          .eq('restaurant_id', ctx.restaurantId)
          .not('cout_de_revient', 'is', null),
      ])

      const ventes = ventesResult.data ?? []
      const charges = chargesResult.data
      const platsAvecCout = platsResult.data ?? []

      const ca_total = ventes.reduce((sum, v) => sum + (v.montant_total ?? 0), 0)
      const nb_couverts = ventes.reduce((sum, v) => sum + (v.nb_couverts ?? 0), 0)
      const panier_moyen = nb_couverts > 0 ? ca_total / nb_couverts : null

      const platsMap = Object.fromEntries(platsAvecCout.map((p) => [p.id, p.cout_de_revient]))
      const food_cost_euros = ventes.reduce((sum, v) => {
        if (!v.plat_id || !v.quantite) return sum
        const cout = platsMap[v.plat_id]
        if (cout == null) return sum
        return sum + v.quantite * cout
      }, 0)

      const food_cost_pct =
        ca_total > 0 && food_cost_euros > 0
          ? Math.round((food_cost_euros / ca_total) * 10000) / 100
          : null

      const masse_salariale = charges?.masse_salariale ?? null
      const charges_fixes = charges
        ? (charges.loyer ?? 0) +
          (charges.energie ?? 0) +
          (charges.assurances ?? 0) +
          (charges.autres_charges ?? 0)
        : null

      const marge_brute =
        ca_total > 0
          ? ca_total - food_cost_euros - (masse_salariale ?? 0) - (charges_fixes ?? 0)
          : null

      const seuil_rentabilite =
        charges_fixes && food_cost_pct && food_cost_pct < 100
          ? charges_fixes / (1 - food_cost_pct / 100)
          : null

      return {
        ca_total: Math.round(ca_total * 100) / 100,
        food_cost_euros: Math.round(food_cost_euros * 100) / 100,
        food_cost_pct,
        masse_salariale,
        charges_fixes,
        marge_brute: marge_brute != null ? Math.round(marge_brute * 100) / 100 : null,
        seuil_rentabilite:
          seuil_rentabilite != null ? Math.round(seuil_rentabilite * 100) / 100 : null,
        nb_couverts,
        panier_moyen: panier_moyen != null ? Math.round(panier_moyen * 100) / 100 : null,
        periode: input.periode,
        date_debut: dateDebut,
        date_fin: dateFin,
        nb_ingredients_avec_prix: nb_ingredients_avec_prix ?? 0,
      }
    }),

  // ═══ IMPORT VENTES CSV ═══
  importVentes: protectedProcedure
    .input(
      z.object({
        lignes: z.array(
          z.object({
            date: z.string(),
            service: z.enum(['midi', 'soir', 'continu']).default('midi'),
            nb_couverts: z.number().int().min(0),
            panier_moyen: z.number().min(0),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const insertions = input.lignes.map((l) => ({
        restaurant_id: ctx.restaurantId,
        date: l.date,
        service: l.service,
        nb_couverts: l.nb_couverts,
        panier_moyen: l.panier_moyen,
        montant_total: l.nb_couverts * l.panier_moyen,
        quantite: l.nb_couverts,
        mode_saisie: 'import_csv',
        notes: l.notes ?? null,
        plat_id: null,
      }))
      const { error } = await ctx.supabase.from('ventes').insert(insertions)
      if (error) throw new Error(error.message)
      return { success: true, nb_lignes: insertions.length }
    }),

  // ═══ RESTAURANT ═══
  getMyRestaurant: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('restaurants')
      .select('id, nom, parametres')
      .eq('id', ctx.restaurantId)
      .single()
    const parametres = (data?.parametres as Record<string, unknown>) ?? {}
    return {
      id: data?.id ?? null,
      nom: data?.nom ?? null,
      type_etablissement: (parametres.type_etablissement as string | undefined) ?? null,
    }
  }),

  updateRestaurant: protectedProcedure
    .input(
      z.object({
        nom: z.string().min(1).max(200).optional(),
        type_etablissement: z
          .enum(['restaurant', 'brasserie', 'gastronomique', 'snack', 'traiteur', 'autre'])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {}

      if (input.nom !== undefined) {
        updates.nom = input.nom
      }

      if (input.type_etablissement !== undefined) {
        const { data: restaurant } = await ctx.supabase
          .from('restaurants')
          .select('parametres')
          .eq('id', ctx.restaurantId)
          .single()

        updates.parametres = {
          ...((restaurant?.parametres as Record<string, unknown>) ?? {}),
          type_etablissement: input.type_etablissement,
        }
      }

      if (Object.keys(updates).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await ctx.supabase
          .from('restaurants')
          .update(updates as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .eq('id', ctx.restaurantId)
        if (error) throw new Error(error.message)
      }

      return { success: true }
    }),

  // ═══ ONBOARDING ═══
  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const { data: restaurant } = await ctx.supabase
      .from('restaurants')
      .select('parametres, created_at')
      .eq('id', ctx.restaurantId)
      .single()

    const parametres = (restaurant?.parametres as Record<string, unknown>) ?? {}
    const onboardingCompletedAt = parametres.onboarding_completed_at as string | undefined

    const createdAt = new Date((restaurant?.created_at as string | null) ?? Date.now())
    const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    const { count: platsCount } = await ctx.supabase
      .from('plats')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', ctx.restaurantId)

    const { data: restaurantIngredients } = await ctx.supabase
      .from('restaurant_ingredients')
      .select('id')
      .eq('restaurant_id', ctx.restaurantId)

    const ingredientIds = restaurantIngredients?.map((i) => i.id) ?? []
    const { count: mercurialeCount } =
      ingredientIds.length > 0
        ? await ctx.supabase
            .from('mercuriale')
            .select('*', { count: 'exact', head: true })
            .in('ingredient_id', ingredientIds)
            .eq('est_actif', true)
        : { count: 0 }

    const { count: bonsCount } = await ctx.supabase
      .from('bons_de_commande')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', ctx.restaurantId)

    return {
      completed: !!onboardingCompletedAt,
      completed_at: onboardingCompletedAt ?? null,
      days_since_creation: daysSinceCreation,
      steps: {
        type_etablissement: !!parametres.type_etablissement,
        premier_plat: (platsCount ?? 0) > 0,
        premiers_prix: (mercurialeCount ?? 0) > 0,
        premiere_commande: (bonsCount ?? 0) > 0,
      },
    }
  }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        type_etablissement: z.enum([
          'restaurant',
          'brasserie',
          'gastronomique',
          'snack',
          'traiteur',
          'autre',
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: restaurant } = await ctx.supabase
        .from('restaurants')
        .select('parametres')
        .eq('id', ctx.restaurantId)
        .single()

      await ctx.supabase
        .from('restaurants')
        .update({
          parametres: {
            ...((restaurant?.parametres as Record<string, unknown>) ?? {}),
            type_etablissement: input.type_etablissement,
            onboarding_completed_at: new Date().toISOString(),
          },
        })
        .eq('id', ctx.restaurantId)

      return { success: true }
    }),

  // ═══ ANALYTIQUES PAR PLAT ═══
  getTopFlop: protectedProcedure
    .input(
      z.object({
        date_debut: z.string(),
        date_fin: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [ventesResult, platsResult] = await Promise.all([
        ctx.supabase
          .from('ventes')
          .select('plat_id, quantite, montant_total')
          .eq('restaurant_id', ctx.restaurantId)
          .gte('date', input.date_debut)
          .lte('date', input.date_fin)
          .not('plat_id', 'is', null),
        ctx.supabase
          .from('plats')
          .select('id, nom, cout_de_revient, prix_vente_ht')
          .eq('restaurant_id', ctx.restaurantId)
          .is('deleted_at', null),
      ])

      const platsMap = Object.fromEntries((platsResult.data ?? []).map((p) => [p.id, p]))

      // Agréger par plat
      const aggregated = new Map<
        string,
        { plat_id: string; nom: string; quantite: number; ca: number; cout_total: number }
      >()

      for (const v of ventesResult.data ?? []) {
        if (!v.plat_id) continue
        const existing = aggregated.get(v.plat_id)
        const plat = platsMap[v.plat_id]
        const nom = plat?.nom ?? 'Plat inconnu'
        const cout = plat?.cout_de_revient ?? null
        const qte = v.quantite ?? 0
        if (existing) {
          existing.quantite += qte
          existing.ca += v.montant_total ?? 0
          existing.cout_total += cout != null ? cout * qte : 0
        } else {
          aggregated.set(v.plat_id, {
            plat_id: v.plat_id,
            nom,
            quantite: qte,
            ca: v.montant_total ?? 0,
            cout_total: cout != null ? cout * qte : 0,
          })
        }
      }

      return Array.from(aggregated.values())
        .map((p) => ({
          ...p,
          ca: Math.round(p.ca * 100) / 100,
          cout_total: Math.round(p.cout_total * 100) / 100,
          food_cost_pct:
            p.ca > 0 && p.cout_total > 0 ? Math.round((p.cout_total / p.ca) * 10000) / 100 : null,
          marge: Math.round((p.ca - p.cout_total) * 100) / 100,
        }))
        .sort((a, b) => b.ca - a.ca)
    }),

  getVentesSemaine: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date()
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })

    const { data: ventes } = await ctx.supabase
      .from('ventes')
      .select('date, montant_total')
      .eq('restaurant_id', ctx.restaurantId)
      .gte('date', dates[0])
      .lte('date', dates[6])

    return dates.map((date) => ({
      date,
      montant:
        ventes?.filter((v) => v.date === date).reduce((s, v) => s + (v.montant_total ?? 0), 0) ?? 0,
    }))
  }),
})
