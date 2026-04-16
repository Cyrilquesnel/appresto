import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Lightspeed signe le payload avec HMAC-SHA256
// Header: X-Lightspeed-Signature

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-lightspeed-signature') ?? ''
  const secret = process.env.LIGHTSPEED_WEBHOOK_SECRET ?? ''

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Lightspeed Restaurant payload :
  // { account_id: "...", report_date: "2024-01-15", day_part: "LUNCH", covers: 28, avg_ticket: 26.50, revenue: 742 }
  const data = payload as {
    account_id?: string
    report_date?: string
    day_part?: string
    covers?: number
    avg_ticket?: number
    revenue?: number
  }

  if (!data.report_date) return NextResponse.json({ error: 'Missing date' }, { status: 422 })
  const date: string = data.report_date

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('parametres->>lightspeed_account_id' as 'id', data.account_id as string)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const serviceMap: Record<string, 'midi' | 'soir' | 'continu'> = {
    LUNCH: 'midi',
    DINNER: 'soir',
    BREAKFAST: 'continu',
    ALL_DAY: 'continu',
  }
  const service = serviceMap[data.day_part ?? ''] ?? 'continu'
  const nb_couverts = data.covers ?? 0
  const panier_moyen = data.avg_ticket ?? 0

  const { error } = await supabase.from('ventes').insert({
    restaurant_id: restaurant.id,
    date,
    service,
    nb_couverts,
    panier_moyen,
    montant_total: data.revenue ?? nb_couverts * panier_moyen,
    quantite: nb_couverts,
    mode_saisie: 'lightspeed',
    plat_id: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
