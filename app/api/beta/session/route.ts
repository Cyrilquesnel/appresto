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
  if (!body?.restaurant_id) {
    return Response.json({ error: 'Missing restaurant_id' }, { status: 400 })
  }

  const { session_id, restaurant_id, page } = body as {
    session_id?: string
    restaurant_id: string
    page?: string
  }

  if (session_id) {
    // Mise à jour session existante
    const { data: existing } = await supabase
      .from('beta_sessions')
      .select('pages_visited')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    const pages: string[] = existing?.pages_visited ?? []
    if (page && !pages.includes(page)) pages.push(page)

    await supabase
      .from('beta_sessions')
      .update({ last_active_at: new Date().toISOString(), pages_visited: pages })
      .eq('id', session_id)
      .eq('user_id', user.id)

    return Response.json({ session_id })
  }

  // Création nouvelle session
  const { data: session } = await supabase
    .from('beta_sessions')
    .insert({
      restaurant_id,
      user_id: user.id,
      pages_visited: page ? [page] : [],
    })
    .select('id')
    .single()

  return Response.json({ session_id: session?.id ?? null })
}
