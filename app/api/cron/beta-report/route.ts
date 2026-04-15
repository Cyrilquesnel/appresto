import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendBetaDailyReport, type BetaUserStats } from '@/lib/email'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface RawBetaStats {
  restaurant_id: string
  restaurant_nom: string
  restaurant_created_at: string
  owner_id: string
  sessions_count: number | string
  avg_session_min: number | string
  total_events_count: number | string
  feature_counts: Record<string, number> | null
  error_count: number | string
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    // 1. Récupérer les stats depuis la BDD
    const { data: rawStats, error: statsError } = await supabase.rpc('get_beta_stats', {
      p_hours: 24,
    })

    if (statsError) throw new Error(`get_beta_stats: ${statsError.message}`)

    const stats = (rawStats ?? []) as RawBetaStats[]

    // 2. Enrichir avec les emails des propriétaires (service role → auth.admin)
    const enriched: BetaUserStats[] = []
    for (const row of stats) {
      let email = 'inconnu'
      if (row.owner_id) {
        const { data: authData } = await supabase.auth.admin.getUserById(row.owner_id)
        email = authData?.user?.email ?? 'inconnu'
      }

      enriched.push({
        restaurant_id: row.restaurant_id,
        restaurant_nom: row.restaurant_nom,
        restaurant_created_at: row.restaurant_created_at,
        owner_id: row.owner_id,
        email,
        sessions_count: Number(row.sessions_count),
        avg_session_min: Number(row.avg_session_min),
        total_events_count: Number(row.total_events_count),
        feature_counts: row.feature_counts ?? {},
        error_count: Number(row.error_count),
      })
    }

    // 3. Envoyer le rapport par email
    const adminEmail = process.env.ADMIN_EMAIL ?? 'lafabriquealimentaire@gmail.com'
    await sendBetaDailyReport(enriched, adminEmail)

    // 4. Heartbeat BetterUptime
    await pingHeartbeat('beta-report')

    console.log(`[beta-report] Rapport envoyé — ${enriched.length} testeurs → ${adminEmail}`)
    return Response.json({ sent: true, users: enriched.length })
  } catch (error) {
    console.error('[beta-report] Erreur:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
