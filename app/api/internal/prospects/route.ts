// Endpoint interne — liste des prospects pour le CRM et les agents CronCreate
// Protégé par INTERNAL_CRON_KEY (vérifié dans middleware.ts)

import { NextRequest } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const statut = searchParams.get('status')
  const minScore = parseInt(searchParams.get('min_score') ?? '0')
  const unscored = searchParams.get('unscored') === 'true'

  let query = supabase
    .from('prospects')
    .select(
      'id, nom, telephone, ville, score, score_breakdown, rating, reviews_count, statut, intent, intent_confidence, last_reply_text, last_reply_at, whatsapp_sent_at, created_at'
    )
    .is('unsubscribed_at', null)
    .order('score', { ascending: false })
    .limit(limit)

  if (statut) query = query.eq('statut', statut)
  if (minScore > 0) query = query.gte('score', minScore)
  if (unscored) query = query.is('score', null)

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ prospects: data ?? [], total: data?.length ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await req.json()

    // Batch score update depuis l'agent CronCreate de scoring
    if (Array.isArray(body)) {
      for (const item of body as { id: string; score: number; score_breakdown?: object }[]) {
        await prospectionTable(supabase, 'prospects')
          .update({ score: item.score, score_breakdown: item.score_breakdown ?? null })
          .eq('id', item.id)
      }
      return Response.json({ updated: body.length })
    }

    return Response.json({ error: 'Format invalide' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
