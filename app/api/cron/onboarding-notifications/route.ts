import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendOnboardingNotification } from '@/lib/push-notifications'
import type { PushSubscription } from 'web-push'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const today = new Date()

  const j1Start = new Date(today)
  j1Start.setDate(j1Start.getDate() - 1)
  const j2Start = new Date(today)
  j2Start.setDate(j2Start.getDate() - 2)

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, parametres, created_at')
    .gte('created_at', j2Start.toISOString().split('T')[0])
    .lte('created_at', j1Start.toISOString().split('T')[0] + 'T23:59:59Z')

  let notified = 0
  for (const restaurant of (restaurants ?? [])) {
    const createdAt = new Date((restaurant.created_at as string | null) ?? Date.now())
    const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    const type = days === 1 ? 'j2' : days === 2 ? 'j3' : null
    if (!type) continue

    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('restaurant_id', restaurant.id)
      .single()

    if (sub) {
      try {
        await sendOnboardingNotification(sub.subscription as unknown as PushSubscription, type)
        console.log(`[onboarding] Push ${type} envoyé — restaurant ${restaurant.id}`)
      } catch (err) {
        console.error(`[onboarding] Push failed — restaurant ${restaurant.id}:`, err)
      }
    } else {
      console.log(`[onboarding] ${type} — pas de subscription pour restaurant ${restaurant.id}`)
    }

    notified++
  }

  return Response.json({ notified })
}
