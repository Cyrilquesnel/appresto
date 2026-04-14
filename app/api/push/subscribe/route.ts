import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// push_subscriptions est une nouvelle table non encore dans les types générés
function pushTable(supabase: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as unknown as any).from('push_subscriptions')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return Response.json({ error: 'Restaurant not found' }, { status: 404 })

  const subscription = await req.json()

  if (!subscription?.endpoint || !subscription?.keys?.auth || !subscription?.keys?.p256dh) {
    return Response.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const { error } = await pushTable(supabase).upsert(
    {
      user_id: user.id,
      restaurant_id: restaurant.id,
      subscription,
      user_agent: req.headers.get('user-agent') ?? '',
    },
    { onConflict: 'user_id' }
  )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await pushTable(supabase).delete().eq('user_id', user.id)
  return Response.json({ success: true })
}
