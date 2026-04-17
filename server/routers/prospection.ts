import { router, adminProcedure } from '../trpc'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'

const StatutEnum = z.enum(['new', 'contacted', 'replied', 'demo', 'client', 'dead'])
const IntentEnum = z.enum(['hot', 'warm', 'cold', 'unsubscribe'])

export const prospectionRouter = router({
  // ═══ LIST ═══
  list: adminProcedure
    .input(
      z.object({
        statut: StatutEnum.optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const supabase = createServiceClient()
      let query = prospectionTable(supabase, 'prospects').select('*', { count: 'exact' })

      if (input.statut) {
        query = query.eq('statut', input.statut)
      }

      if (input.search) {
        query = query.or(
          `nom.ilike.%${input.search}%,ville.ilike.%${input.search}%,email.ilike.%${input.search}%`
        )
      }

      const { data, error, count } = await query
        .order('score', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return {
        prospects: data ?? [],
        total: count ?? 0,
      }
    }),

  // ═══ STATS ═══
  stats: adminProcedure.query(async () => {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('prospection_weekly_stats')
      .select('*')
      .order('week', { ascending: false })
      .limit(2)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    return data ?? []
  }),

  // ═══ COUNT BY STATUT ═══
  countByStatut: adminProcedure.query(async () => {
    const supabase = createServiceClient()
    const statuts = ['new', 'contacted', 'replied', 'demo', 'client', 'dead'] as const

    const counts = await Promise.all(
      statuts.map(async (statut) => {
        const { count, error } = await prospectionTable(supabase, 'prospects')
          .select('*', { count: 'exact', head: true })
          .eq('statut', statut)
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
        return [statut, count ?? 0] as const
      })
    )

    return Object.fromEntries(counts) as Record<(typeof statuts)[number], number>
  }),

  // ═══ UPDATE STATUT ═══
  updateStatut: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        statut: StatutEnum,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = createServiceClient()
      const update: Record<string, unknown> = {
        statut: input.statut,
        updated_at: new Date().toISOString(),
      }
      if (input.notes !== undefined) {
        update.notes = input.notes
      }

      const { error } = await prospectionTable(supabase, 'prospects')
        .update(update)
        .eq('id', input.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  // ═══ UPDATE INTENT ═══
  updateIntent: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        intent: IntentEnum,
      })
    )
    .mutation(async ({ input }) => {
      const supabase = createServiceClient()
      const { error } = await prospectionTable(supabase, 'prospects')
        .update({ intent: input.intent, updated_at: new Date().toISOString() })
        .eq('id', input.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  // ═══ ADD NOTE ═══
  addNote: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = createServiceClient()

      // Fetch existing notes to prepend new one
      const { data: existing, error: fetchError } = await prospectionTable(supabase, 'prospects')
        .select('notes')
        .eq('id', input.id)
        .single()

      if (fetchError)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fetchError.message })

      const datePrefix = new Date().toISOString().split('T')[0]
      const newNote = `[${datePrefix}] ${input.note}`
      const existingNotes = (existing as { notes?: string | null })?.notes
      const updatedNotes = existingNotes ? `${newNote}\n\n${existingNotes}` : newNote

      const { error } = await prospectionTable(supabase, 'prospects')
        .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
        .eq('id', input.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  // ═══ DELETE ═══
  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const supabase = createServiceClient()
    const { error } = await prospectionTable(supabase, 'prospects').delete().eq('id', input.id)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { success: true }
  }),
})
