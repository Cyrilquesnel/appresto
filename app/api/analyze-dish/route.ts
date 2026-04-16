import { NextRequest, NextResponse } from 'next/server'
import { dishAnalysisLimiter } from '@/lib/upstash'
import { analyzeWithRetry } from '@/lib/ai/gemini'
import { enrichIngredients, shouldEnrich } from '@/lib/ai/claude-enrichment'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = request.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  // Rate limiting
  let analysesRestantes: number | null = null
  if (dishAnalysisLimiter) {
    const { success, remaining } = await dishAnalysisLimiter.limit(`dish:${restaurantId}`)
    if (!success) {
      return NextResponse.json(
        { error: "Limite d'analyses atteinte (20/jour). Réessayez demain." },
        { status: 429 }
      )
    }
    analysesRestantes = remaining
  }

  const formData = await request.formData()
  const file = formData.get('image') as File | null

  if (!file) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'Image trop grande (max 10MB)' }, { status: 400 })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Format invalide (JPEG, PNG, WebP)' }, { status: 400 })
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer())
  const imageBase64 = imageBuffer.toString('base64')

  // Upload storage + analyse Gemini en parallèle
  const storagePath = `${restaurantId}/${Date.now()}.jpg`
  const serviceClient = createServiceClient()
  const [geminiResult] = await Promise.all([
    analyzeWithRetry(imageBase64, file.type),
    serviceClient.storage
      .from('dish-photos')
      .upload(storagePath, imageBuffer, { contentType: file.type })
      .then(({ error }) => {
        if (error) console.error('[analyze-dish] Storage upload error:', error.message)
      }),
  ])

  // Enrichissement Claude Haiku (conditionnel — uniquement si confiance faible)
  const ingredientsConfiance = geminiResult.ingredients_detectes.map((i) => i.confiance)
  const needsEnrichment = shouldEnrich(geminiResult.confiance_globale, ingredientsConfiance)

  let enrichedData: Record<
    string,
    { allergenes_confirmes?: string[]; grammage_portion?: number; kcal_par_100g?: number }
  > = {}
  if (needsEnrichment) {
    const lowConfidenceNames = geminiResult.ingredients_detectes
      .filter((i) => i.confiance < 0.55)
      .map((i) => i.nom)

    console.log(
      `[analyze-dish] confiance faible — enrichissement Claude pour: ${lowConfidenceNames.join(', ')}`
    )
    enrichedData = await enrichIngredients(lowConfidenceNames)
  }

  // Fusionner enrichissement sur les données Gemini
  const ingredients = geminiResult.ingredients_detectes.map((ing) => ({
    ...ing,
    allergenes: enrichedData[ing.nom]?.allergenes_confirmes ?? ing.allergenes ?? [],
    grammage_suggere: enrichedData[ing.nom]?.grammage_portion ?? ing.grammage_suggere,
    kcal_par_100g: enrichedData[ing.nom]?.kcal_par_100g,
  }))

  return NextResponse.json({
    type_plat: geminiResult.type_plat,
    ingredients,
    confiance_globale: geminiResult.confiance_globale,
    remarques: geminiResult.remarques,
    enrichissement_utilise: needsEnrichment,
    analyses_restantes: analysesRestantes,
    image_url: storagePath,
  })
}
