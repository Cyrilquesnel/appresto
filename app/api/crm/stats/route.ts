// Proxy serveur → /api/internal/prospection-stats
// La clé INTERNAL_CRON_KEY reste côté serveur, jamais exposée au client

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/prospection-stats`, {
    headers: { Authorization: `Bearer ${process.env.INTERNAL_CRON_KEY}` },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
