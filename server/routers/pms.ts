import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { sendPushNotification } from '@/lib/push-notifications'

const EquipementTypeEnum = z.enum(['frigo', 'congelateur', 'bain_marie', 'four', 'autre'])

export const pmsRouter = router({
  // ═══════════════════════════════════════════
  // TASK 5.1 — ÉQUIPEMENTS + TEMPÉRATURES
  // ═══════════════════════════════════════════

  createEquipement: protectedProcedure
    .input(
      z.object({
        nom: z.string().min(1).max(200),
        type: EquipementTypeEnum,
        temp_min: z.number(),
        temp_max: z.number(),
        frequence_releve: z.enum(['2x_jour', '1x_jour', 'hebdo']).default('2x_jour'),
        localisation: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('equipements')
        .insert({
          restaurant_id: ctx.restaurantId,
          nom: input.nom,
          type: input.type,
          temp_min: input.temp_min,
          temp_max: input.temp_max,
          frequence_releve: input.frequence_releve,
          localisation: input.localisation ?? null,
          actif: true,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  listEquipements: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('equipements')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('actif', true)
      .order('nom')
    return data ?? []
  }),

  // INSERT ONLY — JAMAIS UPDATE NI DELETE (légal HACCP)
  saveTemperatureLog: protectedProcedure
    .input(
      z.object({
        equipement_id: z.string().uuid(),
        valeur: z.number(),
        action_corrective: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: equipement } = await ctx.supabase
        .from('equipements')
        .select('temp_min, temp_max, nom')
        .eq('id', input.equipement_id)
        .eq('restaurant_id', ctx.restaurantId)
        .single()

      if (!equipement) throw new Error('Équipement non trouvé')

      const conforme =
        input.valeur >= (equipement.temp_min ?? -Infinity) &&
        input.valeur <= (equipement.temp_max ?? Infinity)

      const { data, error } = await ctx.supabase
        .from('temperature_logs')
        .insert({
          restaurant_id: ctx.restaurantId,
          equipement_id: input.equipement_id,
          valeur: input.valeur,
          conforme,
          action_corrective: input.action_corrective ?? null,
          releve_par: ctx.user.id,
          timestamp_releve: new Date().toISOString(),
        })
        .select('id, conforme')
        .single()

      if (error) throw new Error(`Erreur INSERT température: ${error.message}`)

      // Alerte push si hors plage
      if (!conforme) {
        try {
          const { data: users } = await ctx.supabase
            .from('restaurant_users')
            .select('user_id')
            .eq('restaurant_id', ctx.restaurantId)

          const userIds = (users ?? []).map((u) => u.user_id)
          if (userIds.length > 0) {
            const { data: subs } = await ctx.supabase
              .from('push_subscriptions')
              .select('subscription')
              .in('user_id', userIds)

            if (subs && subs.length > 0) {
              await Promise.allSettled(
                subs.map((sub) => {
                  const s = sub.subscription as {
                    endpoint: string
                    keys: { p256dh: string; auth: string }
                  }
                  return sendPushNotification(
                    { endpoint: s.endpoint, keys: s.keys },
                    {
                      title: '⚠️ Température hors plage',
                      body: `${equipement.nom} : ${input.valeur}°C (plage ${equipement.temp_min}–${equipement.temp_max}°C)`,
                      icon: '/icons/icon-192.png',
                      badge: '/icons/badge-72.png',
                      data: { url: '/pms/temperatures', type: 'temperature-alert' },
                    }
                  )
                })
              )
            }
          }
        } catch {
          // Notification non critique — ne pas bloquer la réponse
        }
      }

      return { id: data.id, conforme }
    }),

  getTemperatureLogs: protectedProcedure
    .input(
      z.object({
        equipement_id: z.string().uuid().optional(),
        jours: z.number().int().min(1).max(90).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setDate(dateDebut.getDate() - input.jours)

      let query = ctx.supabase
        .from('temperature_logs')
        .select('*, equipement:equipements(nom, temp_min, temp_max, type)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('timestamp_releve', dateDebut.toISOString())
        .order('timestamp_releve', { ascending: false })

      if (input.equipement_id) {
        query = query.eq('equipement_id', input.equipement_id)
      }

      const { data } = await query.limit(500)
      return data ?? []
    }),

  // ═══════════════════════════════════════════
  // TASK 5.2 — CHECKLISTS NETTOYAGE
  // ═══════════════════════════════════════════

  getChecklistsWithStatus: protectedProcedure
    .input(
      z.object({
        date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const targetDate = input.date ?? new Date().toISOString().split('T')[0]

      const { data: checklists } = await ctx.supabase
        .from('nettoyage_checklists')
        .select('*, items:nettoyage_checklist_items(*)')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('actif', true)
        .order('type')

      const { data: completions } = await ctx.supabase
        .from('nettoyage_completions')
        .select('checklist_id, id')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('date', targetDate)

      const completedIds = new Set(completions?.map((c) => c.checklist_id) ?? [])

      return (checklists ?? []).map((c) => ({
        ...c,
        completed_today: completedIds.has(c.id),
      }))
    }),

  saveChecklistCompletion: protectedProcedure
    .input(
      z.object({
        checklist_id: z.string().uuid(),
        date: z.string(),
        items_valides: z.array(
          z.object({
            item_id: z.string(),
            valide: z.boolean(),
            note: z.string().optional(),
          })
        ),
        duree_minutes: z.number().int().min(0).optional(),
        notes_generales: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('nettoyage_completions')
        .insert({
          restaurant_id: ctx.restaurantId,
          checklist_id: input.checklist_id,
          date: input.date,
          items_valides: input.items_valides,
          auteur_id: ctx.user.id,
          duree_minutes: input.duree_minutes ?? null,
        })
        .select('id')
        .single()

      if (error) throw new Error(`Erreur checklist: ${error.message}`)
      return { id: data.id }
    }),

  getChecklistHistory: protectedProcedure
    .input(
      z.object({
        checklist_id: z.string().uuid(),
        jours: z.number().int().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setDate(dateDebut.getDate() - input.jours)

      const { data } = await ctx.supabase
        .from('nettoyage_completions')
        .select('date, duree_minutes, auteur_id, items_valides')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('checklist_id', input.checklist_id)
        .gte('date', dateDebut.toISOString().split('T')[0])
        .order('date', { ascending: false })

      return data ?? []
    }),

  // ═══════════════════════════════════════════
  // TASK 5.3 — RÉCEPTIONS MARCHANDISES
  // ═══════════════════════════════════════════

  createReception: protectedProcedure
    .input(
      z.object({
        fournisseur_id: z.string().uuid(),
        date_reception: z.string(),
        numero_bl: z.string().optional(),
        bon_de_commande_id: z.string().uuid().optional(),
        items: z.array(
          z.object({
            ingredient_id: z.string().uuid().optional(),
            nom_produit: z.string().min(1),
            quantite: z.number().positive(),
            unite: z.string().min(1),
            dlc: z.string().optional(),
            numero_lot: z.string().optional(),
            temperature_reception: z.number().optional(),
            conforme: z.boolean().default(true),
            anomalie_description: z.string().optional(),
          })
        ),
        statut: z.enum(['conforme', 'anomalie', 'refuse']).default('conforme'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nonConformes = input.items.filter((i) => !i.conforme && !i.anomalie_description)
      if (nonConformes.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "Description d'anomalie obligatoire pour les items non-conformes",
        })
      }

      const hasAnomalie = input.items.some((i) => !i.conforme)
      const statut = hasAnomalie ? 'anomalie' : input.statut

      const { data: reception, error } = await ctx.supabase
        .from('receptions')
        .insert({
          restaurant_id: ctx.restaurantId,
          fournisseur_id: input.fournisseur_id,
          date_reception: input.date_reception,
          numero_bl: input.numero_bl ?? null,
          bon_de_commande_id: input.bon_de_commande_id ?? null,
          statut,
          receptionne_par: ctx.user.id,
        })
        .select('id')
        .single()

      if (error || !reception) throw new Error(error?.message ?? 'Erreur création réception')

      const { error: itemsError } = await ctx.supabase.from('reception_items').insert(
        input.items.map((item) => ({
          reception_id: reception.id,
          restaurant_id: ctx.restaurantId,
          ingredient_id: item.ingredient_id ?? null,
          nom_produit: item.nom_produit,
          quantite: item.quantite,
          unite: item.unite,
          dlc: item.dlc ?? null,
          numero_lot: item.numero_lot ?? null,
          temperature_reception: item.temperature_reception ?? null,
          conforme: item.conforme,
          anomalie_description: item.anomalie_description ?? null,
        }))
      )

      if (itemsError) throw new Error(itemsError.message)

      if (input.bon_de_commande_id) {
        await ctx.supabase
          .from('bons_de_commande')
          .update({ statut: 'recu' })
          .eq('id', input.bon_de_commande_id)
          .eq('restaurant_id', ctx.restaurantId)
      }

      return { id: reception.id, statut }
    }),

  getReceptions: protectedProcedure
    .input(
      z.object({
        fournisseur_id: z.string().uuid().optional(),
        jours: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setDate(dateDebut.getDate() - input.jours)

      let query = ctx.supabase
        .from('receptions')
        .select('*, fournisseur:fournisseurs(nom), items:reception_items(*)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date_reception', dateDebut.toISOString().split('T')[0])
        .order('date_reception', { ascending: false })

      if (input.fournisseur_id) {
        query = query.eq('fournisseur_id', input.fournisseur_id)
      }

      const { data } = await query
      return data ?? []
    }),

  // ═══════════════════════════════════════════
  // TASK 5.4 — HACCP AUTO-GÉNÉRATION
  // ═══════════════════════════════════════════

  generateHACCP: protectedProcedure.mutation(async ({ ctx }) => {
    const { count } = await ctx.supabase
      .from('plats')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', ctx.restaurantId)
      .eq('statut', 'actif')

    if ((count ?? 0) < 3) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Créez au moins 3 plats actifs pour générer le plan HACCP',
      })
    }

    const { data: plats, error: platsError } = await ctx.supabase
      .from('plats')
      .select(
        `id, nom, type_plat, fiche_technique(ingredient:restaurant_ingredients(nom_custom, allergenes_override))`
      )
      .eq('restaurant_id', ctx.restaurantId)
      .eq('statut', 'actif')
      .limit(20)

    if (platsError) throw new Error(platsError.message)
    if (!plats || plats.length === 0) throw new Error('Aucun plat actif trouvé')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const platsFormatted = plats.map((p: any) => ({
      id: p.id,
      nom: p.nom,
      type_plat: p.type_plat,
      ingredients: (
        p.fiche_technique as Array<{
          ingredient: { nom_custom: string | null; allergenes_override: string[] | null } | null
        }>
      ).map((ft) => ({
        nom: ft.ingredient?.nom_custom ?? 'Ingrédient inconnu',
        allergenes: ft.ingredient?.allergenes_override ?? [],
      })),
    }))

    const { generateHACCPPlan } = await import('@/lib/ai/haccp-generator')
    const points = await generateHACCPPlan(platsFormatted)

    // Régénération complète (delete + insert)
    await ctx.supabase.from('haccp_points_critiques').delete().eq('restaurant_id', ctx.restaurantId)

    if (points.length > 0) {
      await ctx.supabase.from('haccp_points_critiques').insert(
        points.map((p) => ({
          restaurant_id: ctx.restaurantId,
          plat_id: p.plat_id,
          plat_nom: p.plat_nom ?? null,
          danger: p.danger,
          etape: p.etape_critique,
          etape_critique: p.etape_critique,
          ccp_numero: p.ccp_numero,
          temperature_critique: p.temperature_critique ?? null,
          limite_critique: p.limite_critique,
          mesure_surveillance: p.mesure_surveillance,
          action_corrective: p.action_corrective,
          verification: p.verification,
          genere_le: new Date().toISOString(),
        }))
      )
    }

    return { points_count: points.length, points }
  }),

  getHACCPPlan: protectedProcedure.query(async ({ ctx }) => {
    const { count: platsCount } = await ctx.supabase
      .from('plats')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', ctx.restaurantId)
      .eq('statut', 'actif')

    const { data: points } = await ctx.supabase
      .from('haccp_points_critiques')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .order('ccp_numero')

    return {
      can_generate: (platsCount ?? 0) >= 3,
      plats_count: platsCount ?? 0,
      points: points ?? [],
      last_generated: points?.[0]?.genere_le ?? null,
    }
  }),

  // ═══════════════════════════════════════════
  // TASK 5.5 — RAPPELCONSO ALERTES
  // ═══════════════════════════════════════════

  getRappelAlerts: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('rappel_alerts')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
      .limit(50)
    return data ?? []
  }),

  markRappelTraite: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('rappel_alerts')
        .update({ traite: true, traite_le: new Date().toISOString() })
        .eq('id', input.alertId)
        .eq('restaurant_id', ctx.restaurantId)
      return { success: true }
    }),

  // ═══════════════════════════════════════════
  // TASK 5.6 — DDPP DATA
  // ═══════════════════════════════════════════

  getDDPPData: protectedProcedure
    .input(
      z.object({
        mois: z.number().int().min(1).max(12).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setMonth(dateDebut.getMonth() - input.mois)
      const dateDebutStr = dateDebut.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]

      const [
        restaurantResult,
        temperaturesResult,
        checklistsResult,
        receptionsResult,
        haccpResult,
      ] = await Promise.all([
        ctx.supabase.from('restaurants').select('*').eq('id', ctx.restaurantId).single(),
        ctx.supabase
          .from('temperature_logs')
          .select('*, equipement:equipements(nom, type, temp_min, temp_max)')
          .eq('restaurant_id', ctx.restaurantId)
          .gte('timestamp_releve', dateDebut.toISOString())
          .order('timestamp_releve', { ascending: true }),
        ctx.supabase
          .from('nettoyage_completions')
          .select('*, checklist:nettoyage_checklists(nom, type)')
          .eq('restaurant_id', ctx.restaurantId)
          .gte('date', dateDebutStr)
          .order('date', { ascending: true }),
        ctx.supabase
          .from('receptions')
          .select('*, fournisseur:fournisseurs(nom), items:reception_items(*)')
          .eq('restaurant_id', ctx.restaurantId)
          .gte('date_reception', dateDebutStr)
          .order('date_reception', { ascending: true }),
        ctx.supabase
          .from('haccp_points_critiques')
          .select('*')
          .eq('restaurant_id', ctx.restaurantId)
          .order('ccp_numero'),
      ])

      return {
        restaurant: restaurantResult.data,
        periode: { debut: dateDebutStr, fin: today, mois: input.mois },
        temperatures: temperaturesResult.data ?? [],
        checklists: checklistsResult.data ?? [],
        receptions: receptionsResult.data ?? [],
        haccp: haccpResult.data ?? [],
        generated_at: new Date().toISOString(),
      }
    }),
})
