import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Cashpad — API Key dans header X-Cashpad-Api-Key

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-cashpad-api-key')
  if (apiKey !== process.env.CASHPAD_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Cashpad payload :
  // { site_id: "...", date: "2024-01-15", period: "lunch", guests: 28, avg_ticket: 26.50, revenue: 742 }
  const data = body as {
    site_id?: string
    date?: string
    period?: string
    guests?: number
    avg_ticket?: number
    revenue?: number
  }

  if (!data.date) return NextResponse.json({ error: 'Missing date' }, { status: 422 })
  const date: string = data.date

  const supabase = createServiceClient()

  const { data: restaurants } = await supabase.from('restaurants').select('id, parametres')
  const restaurant = restaurants?.find(
    (r) => (r.parametres as Record<string, unknown>)?.cashpad_site_id === data.site_id
  )

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    lunch: 'midi',
    dinner: 'soir',
    all: 'continu',
  }
  const service = serviceMap[data.period?.toLowerCase() ?? ''] ?? 'continu'
  const nb_couverts = data.guests ?? 0
  const panier_moyen = data.avg_ticket ?? 0

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: data.revenue ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'cashpad',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
