import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Innovorder — HMAC-SHA256, header X-Innovorder-Signature

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-innovorder-signature') ?? ''
  const secret = process.env.INNOVORDER_WEBHOOK_SECRET ?? ''

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Innovorder payload :
  // { brand_id: "...", date: "2024-01-15", meal_period: "lunch", guest_count: 28, avg_basket: 26.50, total_revenue: 742 }
  const data = payload as {
    brand_id?: string
    date?: string
    meal_period?: string
    guest_count?: number
    avg_basket?: number
    total_revenue?: number
  }

  if (!data.date) return NextResponse.json({ error: 'Missing date' }, { status: 422 })
  const date: string = data.date

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('parametres->>innovorder_brand_id' as 'id', data.brand_id as string)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    lunch: 'midi',
    dinner: 'soir',
    breakfast: 'continu',
    all_day: 'continu',
  }
  const service = serviceMap[data.meal_period?.toLowerCase() ?? ''] ?? 'continu'
  const nb_couverts = data.guest_count ?? 0
  const panier_moyen = data.avg_basket ?? 0

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: data.total_revenue ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'innovorder',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
