import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPMSReminder } from '@/lib/push-notifications'
import { pingHeartbeat } from '@/lib/betteruptime'
import type { PushSubscription } from 'web-push'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('subscription, restaurant_id')

  let sent = 0
  let failed = 0

  for (const row of subscriptions ?? []) {
    try {
      await sendPMSReminder(row.subscription as unknown as PushSubscription)
      sent++
    } catch (err) {
      console.error(`[temperature-reminders] Push failed for restaurant ${row.restaurant_id}:`, err)
      failed++
    }
  }

  await pingHeartbeat('temperatures')

  console.log(`[temperature-reminders] sent=${sent} failed=${failed}`)
  return Response.json({ sent, failed })
}
