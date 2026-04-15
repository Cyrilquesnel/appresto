import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Zelty envoie un header X-Zelty-Secret pour valider l'authenticité
// Configurer dans Zelty → Intégrations → Webhooks → Secret

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-zelty-secret')
  if (secret !== process.env.ZELTY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Zelty payload (exemple) :
  // { restaurant_id: "...", date: "2024-01-15", service: "midi", covers: 28, average_ticket: 26.50 }
  const payload = body as {
    restaurant_zelty_id?: string
    date?: string
    service?: string
    covers?: number
    average_ticket?: number
    total_revenue?: number
  }

  if (!payload.date || payload.covers == null || payload.average_ticket == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 422 })
  }
  const date: string = payload.date
  const nb_couverts: number = payload.covers
  const panier_moyen: number = payload.average_ticket

  const supabase = createServiceClient()

  // Retrouver le restaurant par zelty_restaurant_id stocké dans parametres
  const { data: restaurants } = await supabase.from('restaurants').select('id, parametres')

  const restaurant = restaurants?.find(
    (r) =>
      (r.parametres as Record<string, unknown>)?.zelty_restaurant_id === payload.restaurant_zelty_id
  )

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    midi: 'midi',
    lunch: 'midi',
    soir: 'soir',
    dinner: 'soir',
    continu: 'continu',
  }
  const service = serviceMap[payload.service?.toLowerCase() ?? ''] ?? 'continu'

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: payload.total_revenue ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'zelty',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
