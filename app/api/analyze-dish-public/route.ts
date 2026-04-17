import { NextRequest, NextResponse } from 'next/server'
import { leadMagnetLimiter } from '@/lib/upstash'
import { analyzeWithRetry } from '@/lib/ai/gemini'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Rate limiting par IP — 3 analyses / 24h
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'

  if (leadMagnetLimiter) {
    const { success, remaining } = await leadMagnetLimiter.limit(`lead:${ip}`)
    if (!success) {
      return NextResponse.json(
        {
          error:
            'Limite atteinte : 3 analyses gratuites par jour. Créez un compte pour des analyses illimitées.',
        },
        { status: 429 }
      )
    }
    console.log(`[analyze-dish-public] IP ${ip} — ${remaining} analyses restantes`)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'Image trop grande (max 10 Mo)' }, { status: 400 })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json(
      { error: 'Format invalide (JPEG, PNG, WebP uniquement)' },
      { status: 400 }
    )
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer())
  const imageBase64 = imageBuffer.toString('base64')

  const geminiResult = await analyzeWithRetry(imageBase64, file.type)

  return NextResponse.json({
    ingredients: geminiResult.ingredients_detectes,
    type_plat: geminiResult.type_plat,
    confiance: geminiResult.confiance_globale,
    remarques: geminiResult.remarques ?? null,
  })
}
