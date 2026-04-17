// Endpoint interne — stats hebdomadaires pour le CRM et le rapport
// Protégé par INTERNAL_CRON_KEY

import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()

  const { data } = await supabase.from('prospection_weekly_stats').select('*').limit(1).single()

  return Response.json(
    data ?? {
      total_leads: 0,
      contacts_sent: 0,
      replies: 0,
      reply_rate_pct: 0,
      hot_leads: 0,
      demos_booked: 0,
      conversions: 0,
    }
  )
}
