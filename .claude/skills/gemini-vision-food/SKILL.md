---
name: gemini-vision-food
description: Analyse de photos de plats et OCR de factures fournisseurs avec Gemini 2.0 Flash. Utilise quand tu dois analyser une image culinaire ou extraire des données d'une facture.
---

# Gemini Vision — Food Analysis & Invoice OCR

## Setup
```bash
npm install @google/generative-ai
```
```env
GEMINI_API_KEY=  # Google AI Studio — free tier 1500 req/jour
```

## Analyse photo plat (pipeline 2 étapes)

### Étape 1 : Gemini Flash Vision
```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function analyzeDishPhoto(imageBase64: string, mimeType: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { /* voir research/ai-image-pipeline-food.md */ }
    }
  })
  const result = await model.generateContent([prompt, { inlineData: { mimeType, data: imageBase64 } }])
  return JSON.parse(result.response.text())
}
```

### Étape 2 : Enrichissement Claude si confiance < 0.65
Voir skill `claude-haiku-enrichment` (à créer si besoin).

## Rate limiting OBLIGATOIRE
```typescript
import { dishAnalysisLimiter } from '@/lib/upstash'
const { success } = await dishAnalysisLimiter.limit(`dish:${restaurantId}`)
if (!success) return 429 // 20 analyses/jour/restaurant
```

## OCR Factures fournisseurs
Même modèle, prompt spécialisé extraction facture (voir research/ai-image-pipeline-food.md section 7).

## Coûts
- Free tier : 1 500 req/jour (suffisant beta)
- Pay-as-you-go : ~$0.0002/analyse

## Pièges
- iOS PWA : utiliser `input[type=file][capture=environment]`, PAS getUserMedia
- Images > 10MB : compresser avant upload (voir composant DishCamera)
- Timeout Vercel : Gemini répond en 1-3s, pas de problème
- Erreur 429 Gemini : retry avec exponential backoff (max 3 tentatives)

## Références
- Code complet : research/ai-image-pipeline-food.md
- Composant caméra : research/next-js-pwa-supabase.md section 7
