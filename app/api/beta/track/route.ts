import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.restaurant_id) {
    return Response.json({ error: 'Missing type or restaurant_id' }, { status: 400 })
  }

  const { error } = await supabase.from('events').insert({
    restaurant_id: body.restaurant_id,
    type: String(body.type),
    payload: body.payload ?? {},
    user_id: user.id,
  })

  if (error) {
    console.error('[beta/track]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
