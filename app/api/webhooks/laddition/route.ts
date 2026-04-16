import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// L'Addition — HMAC-SHA256, header X-LAddition-Signature

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
  const signature = req.headers.get('x-laddition-signature') ?? ''
  const secret = process.env.LADDITION_WEBHOOK_SECRET ?? ''

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // L'Addition payload :
  // { place_id: "...", business_date: "2024-01-15", service: "DEJEUNER", covers: 28, average_check: 26.50, net_sales: 742 }
  const data = payload as {
    place_id?: string
    business_date?: string
    service?: string
    covers?: number
    average_check?: number
    net_sales?: number
  }

  if (!data.business_date) return NextResponse.json({ error: 'Missing date' }, { status: 422 })
  const date: string = data.business_date

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('parametres->>laddition_place_id' as 'id', data.place_id as string)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    DEJEUNER: 'midi',
    DINER: 'soir',
    JOURNEE: 'continu',
  }
  const service = serviceMap[data.service ?? ''] ?? 'continu'
  const nb_couverts = data.covers ?? 0
  const panier_moyen = data.average_check ?? 0

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: data.net_sales ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'laddition',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
