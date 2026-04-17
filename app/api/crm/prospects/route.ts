// Proxy serveur → /api/internal/prospects
// La clé INTERNAL_CRON_KEY reste côté serveur, jamais exposée au client

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qs = searchParams.toString()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/prospects${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${process.env.INTERNAL_CRON_KEY}` } }
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/prospects`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${process.env.INTERNAL_CRON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
