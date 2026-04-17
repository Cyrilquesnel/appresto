// Proxy serveur → /api/internal/prospects/import
// La clé INTERNAL_CRON_KEY reste côté serveur

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/prospects/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.INTERNAL_CRON_KEY}` },
    body: formData,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
