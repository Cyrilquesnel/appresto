# Task 2.1: Upload Photo + Pipeline Gemini Vision

## Objective
Créer le pipeline complet d'analyse photo : composant DishCamera (caméra iOS native), upload Supabase Storage, analyse Gemini 2.0 Flash avec rate limiting Upstash (20/jour/restaurant).

## Context
C'est le cœur du produit. La photo → IA est la première action de l'utilisateur en onboarding. Doit fonctionner en < 5s sur iPhone.

## Dependencies
- Task 1.4 — tRPC context + restaurantId disponible
- Task 1.2 — Supabase Storage bucket créé

## Blocked By
- Task 1.4

## Implementation Plan

### Step 1: Configurer Supabase Storage bucket

Dans Supabase Studio local (http://localhost:54323) → Storage → créer bucket `dish-photos` (public: false).

Ajouter politique RLS storage via SQL :
```sql
-- Politique storage : accès uniquement au dossier du restaurant
CREATE POLICY "restaurant_dish_photos" ON storage.objects
  FOR ALL USING (
    bucket_id = 'dish-photos' AND
    (storage.foldername(name))[1] = (
      SELECT restaurant_id::text FROM restaurant_users
      WHERE user_id = auth.uid() LIMIT 1
    )
  );
```

### Step 2: Upstash Redis — Rate Limiter

```typescript
// lib/upstash.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Ne pas crasher si Upstash non configuré en dev
const getRedis = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null
  return Redis.fromEnv()
}

const redis = getRedis()

export const dishAnalysisLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24h"),
  analytics: true,
  prefix: "dish-analysis",
}) : null

export const invoiceOCRLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "24h"),
  prefix: "invoice-ocr",
}) : null

export const globalApiLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(200, "1m"),
  prefix: "global",
}) : null
```

### Step 3: Client Gemini Vision

```typescript
// lib/ai/gemini.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const ingredientSchema = {
  type: SchemaType.OBJECT,
  properties: {
    type_plat: { type: SchemaType.STRING },
    ingredients_detectes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nom: { type: SchemaType.STRING },
          categorie: {
            type: SchemaType.STRING,
            enum: ["viande", "poisson", "legume", "feculent", "sauce", "fromage", "laitage", "autre"]
          },
          visible: { type: SchemaType.BOOLEAN },
          grammage_suggere: { type: SchemaType.NUMBER },
          allergenes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confiance: { type: SchemaType.NUMBER }
        },
        required: ["nom", "categorie", "visible", "confiance"]
      }
    },
    confiance_globale: { type: SchemaType.NUMBER },
    remarques: { type: SchemaType.STRING }
  },
  required: ["type_plat", "ingredients_detectes", "confiance_globale"]
}

export async function analyzeDishPhoto(imageBase64: string, mimeType: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ingredientSchema,
    },
  })

  const result = await model.generateContent([
    `Tu es un expert en restauration professionnelle française.
Analyse cette photo de plat et identifie les ingrédients visibles.
Détecte uniquement ce qui est clairement visible. Ne devine pas les ingrédients cachés.
Indique ta confiance honnêtement (0.0 à 1.0).
Pour les allergènes, utilise : gluten, crustaces, oeufs, poisson, arachides, soja, lait, fruits_a_coque, celeri, moutarde, sesame, sulfites, lupin, mollusques`,
    { inlineData: { mimeType, data: imageBase64 } }
  ])

  return JSON.parse(result.response.text())
}

export async function analyzeWithRetry(imageBase64: string, mimeType: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyzeDishPhoto(imageBase64, mimeType)
    } catch (error: any) {
      if (error.status === 429 || error.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
        continue
      }
      throw error
    }
  }
  throw new Error("Gemini: max retries exceeded")
}
```

### Step 4: Supabase Storage helper

```typescript
// lib/supabase/storage.ts
import { createClient } from "@/lib/supabase/server"

export async function uploadDishPhoto(file: File, restaurantId: string): Promise<string> {
  const supabase = createClient()
  const maxSize = 10 * 1024 * 1024
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]

  if (file.size > maxSize) throw new Error("Image trop grande (max 10MB)")
  if (!allowedTypes.includes(file.type)) throw new Error("Format invalide (JPEG, PNG, WebP)")

  const fileName = `${restaurantId}/${Date.now()}-${crypto.randomUUID()}.jpg`

  const { data, error } = await supabase.storage
    .from("dish-photos")
    .upload(fileName, file, { contentType: file.type, upsert: false })

  if (error) throw error
  return data.path
}
```

### Step 5: Route API analyze-dish

```typescript
// app/api/analyze-dish/route.ts
import { NextRequest, NextResponse } from "next/server"
import { dishAnalysisLimiter } from "@/lib/upstash"
import { analyzeWithRetry } from "@/lib/ai/gemini"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const restaurantId = request.headers.get("x-restaurant-id")
  if (!restaurantId) return NextResponse.json({ error: "restaurant_id manquant" }, { status: 400 })

  // Rate limiting
  if (dishAnalysisLimiter) {
    const { success, remaining } = await dishAnalysisLimiter.limit(`dish:${restaurantId}`)
    if (!success) {
      return NextResponse.json(
        { error: "Limite d'analyses atteinte (20/jour). Réessayez demain." },
        { status: 429 }
      )
    }
    request.headers.set("x-remaining", remaining.toString())
  }

  const formData = await request.formData()
  const file = formData.get("image") as File

  if (!file) return NextResponse.json({ error: "Image manquante" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image trop grande" }, { status: 400 })
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 })
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer())
  const imageBase64 = imageBuffer.toString("base64")

  // Upload storage (fire and forget)
  const storagePath = `${restaurantId}/${Date.now()}.jpg`
  supabase.storage.from("dish-photos").upload(storagePath, imageBuffer, { contentType: file.type })
    .catch(err => console.error("Storage upload error:", err))

  // Analyse Gemini
  const result = await analyzeWithRetry(imageBase64, file.type)

  return NextResponse.json({
    type_plat: result.type_plat,
    ingredients: result.ingredients_detectes,
    confiance_globale: result.confiance_globale,
    remarques: result.remarques,
    image_url: storagePath,
  })
}
```

### Step 6: Composant DishCamera

```tsx
// components/dishes/DishCamera.tsx
'use client'
import { useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  preview?: string | null
}

export function DishCamera({ onCapture, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      const compressed = await compressImage(file)
      onCapture(compressed)
    } else {
      onCapture(file)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        data-testid="dish-file-input"
      />
      {preview ? (
        <img
          src={preview}
          alt="Plat"
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: '300px' }}
          onClick={() => inputRef.current?.click()}
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500"
          data-testid="camera-btn"
        >
          <span className="text-4xl">📸</span>
          <span className="text-sm font-medium">Photographier le plat</span>
          <span className="text-xs text-gray-400">ou choisir depuis la galerie</span>
        </button>
      )}
    </div>
  )
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.onload = () => {
      const MAX = 1080
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = (height / width) * MAX; width = MAX }
        else { width = (width / height) * MAX; height = MAX }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg', 0.85
      )
    }
    img.src = URL.createObjectURL(file)
  })
}
```

### Step 7: Page nouveau plat

```tsx
// app/(app)/plats/nouveau/page.tsx
'use client'
import { useState } from 'react'
import { DishCamera } from '@/components/dishes/DishCamera'
import { useRouter } from 'next/navigation'

export default function NouveauPlatPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCapture = async (file: File) => {
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/analyze-dish', {
        method: 'POST',
        headers: { 'x-restaurant-id': localStorage.getItem('restaurant-store') ?? '' },
        body: formData,
      })

      if (res.status === 429) {
        setError('Limite atteinte : 20 analyses par jour. Réessayez demain.')
        setLoading(false)
        return
      }

      if (!res.ok) throw new Error('Erreur analyse')
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError('Impossible d\'analyser la photo. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Nouveau plat</h1>

      <DishCamera onCapture={handleCapture} preview={preview} />

      {loading && (
        <div className="mt-4 text-center" data-testid="ai-loading">
          <p className="text-gray-600">Analyse en cours...</p>
        </div>
      )}

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}

      {result && !loading && (
        <div className="mt-4" data-testid="ingredients-list">
          <h2 className="font-semibold mb-2">Ingrédients détectés ({result.type_plat})</h2>
          {result.ingredients.map((ing: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b" data-testid="ingredient-item">
              <span className="flex-1">{ing.nom}</span>
              <span className="text-sm text-gray-500">{ing.grammage_suggere ?? '?'}g</span>
              <span className="text-xs text-gray-400">{Math.round(ing.confiance * 100)}%</span>
            </div>
          ))}
          <button
            onClick={() => router.push('/plats/nouveau/fiche')}
            className="mt-4 w-full py-3 rounded-lg text-white font-semibold"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Créer la fiche technique →
          </button>
        </div>
      )}
    </div>
  )
}
```

### Step 8: Liste des plats

```tsx
// app/(app)/plats/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function PlatsPage() {
  const supabase = createClient()
  const { data: plats } = await supabase
    .from('plats')
    .select('id, nom, photo_url, cout_de_revient, statut')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Mes plats</h1>
        <a href="/plats/nouveau"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-accent)' }}
          data-testid="add-dish-btn">
          + Nouveau
        </a>
      </div>
      {(!plats || plats.length === 0) && (
        <p className="text-gray-500 text-center mt-8">
          Aucun plat — photographiez votre premier plat !
        </p>
      )}
      {plats?.map(plat => (
        <a key={plat.id} href={`/plats/${plat.id}`}
          className="block border rounded-xl p-3 mb-3">
          <div className="flex justify-between">
            <span className="font-medium">{plat.nom}</span>
            {plat.cout_de_revient && (
              <span className="text-sm text-gray-500">{plat.cout_de_revient.toFixed(2)}€</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{plat.statut}</span>
        </a>
      ))}
    </div>
  )
}
```

## Files to Create

- `lib/ai/gemini.ts`
- `lib/upstash.ts`
- `lib/supabase/storage.ts`
- `app/api/analyze-dish/route.ts`
- `components/dishes/DishCamera.tsx`
- `app/(app)/plats/nouveau/page.tsx`
- `app/(app)/plats/page.tsx`

## Contracts

### Provides
- `POST /api/analyze-dish` → `{ type_plat, ingredients: DetectedIngredient[], confiance_globale, image_url }`
- `analyzeWithRetry(imageBase64, mimeType)` — Gemini avec retry
- `<DishCamera onCapture>` — composant caméra iOS
- Rate limit 20/jour/restaurant via Upstash

### Consumes
- `x-restaurant-id` header depuis Zustand store (Task 1.4)
- Supabase Storage bucket `dish-photos`

## Acceptance Criteria

- [ ] Upload photo → ingrédients listés en < 5s
- [ ] 21ème analyse → HTTP 429 avec message clair
- [ ] Image > 2MB → compressée côté client avant upload
- [ ] Gemini 429/503 → retry 3x avec backoff (pas de crash)
- [ ] `data-testid="ingredients-list"` visible après analyse
- [ ] `data-testid="ai-loading"` visible pendant l'analyse

## Testing Protocol

### Unit Tests
```typescript
// tests/unit/gemini.test.ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/ai/gemini')

describe('analyzeWithRetry', () => {
  it('retries on 429 and succeeds', async () => { ... })
  it('throws after max retries', async () => { ... })
})
```

### Playwright E2E
```typescript
// tests/e2e/dish-photo-flow.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

test('upload photo → ingrédients détectés', async ({ page }) => {
  // Login
  await page.goto('/plats/nouveau')
  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/dish-steak.jpg'))
  await expect(page.locator('[data-testid=ai-loading]')).toBeVisible()
  await expect(page.locator('[data-testid=ingredients-list]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid=ingredient-item]')).toHaveCount({ minimum: 1 })
})
```

### Vercel Logs
Après upload → vérifier Supabase Storage : fichier présent dans bucket `dish-photos`.

## Skills to Read
- `gemini-vision-food`
- `supabase-rls-multitenant`
- `nextjs-pwa-mobile`

## Git
- Branch: `phase-2/operer`
- Commit: `Task 2.1:`

## PROGRESS.md Update
Marquer Task 2.1 ✅
