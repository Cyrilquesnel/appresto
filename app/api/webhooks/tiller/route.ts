import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Tiller (SumUp) — header Authorization: Bearer <token>

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace('Bearer ', '')
  if (token !== process.env.TILLER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Tiller payload :
  // { restaurant_id: "...", date: "2024-01-15", shift: "lunch", guests: 28, avg_basket: 26.50, total: 742 }
  const data = body as {
    restaurant_id?: string
    date?: string
    shift?: string
    guests?: number
    avg_basket?: number
    total?: number
  }

  if (!data.date) return NextResponse.json({ error: 'Missing date' }, { status: 422 })
  const date: string = data.date

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('parametres->>tiller_restaurant_id' as 'id', data.restaurant_id as string)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    lunch: 'midi',
    dinner: 'soir',
    all_day: 'continu',
  }
  const service = serviceMap[data.shift?.toLowerCase() ?? ''] ?? 'continu'
  const nb_couverts = data.guests ?? 0
  const panier_moyen = data.avg_basket ?? 0

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: data.total ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'tiller',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
