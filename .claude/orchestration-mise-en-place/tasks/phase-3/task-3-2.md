# Task 3.2: OCR Factures Fournisseurs (Gemini)

## Objective
Photo d'une facture fournisseur → extraction structurée (produits, prix, DLC, numéros lot) → mise à jour automatique mercuriale + pré-remplissage réception PMS.

## Context
Les restaurateurs reçoivent des factures papier. Photographier la facture permet d'extraire automatiquement les prix et de mettre à jour la mercuriale sans ressaisie manuelle. Même pipeline que l'analyse de plats (Gemini vision), mais avec un schéma différent orienté facture.

## Dependencies
- Task 3.1 — mercuriale + fournisseurs CRUD opérationnels

## Blocked By
- Task 3.1

## Implementation Plan

### Step 1: lib/ai/invoice-ocr.ts

```typescript
// lib/ai/invoice-ocr.ts
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface InvoiceLine {
  designation: string           // nom du produit tel qu'écrit
  dlc?: string                  // format ISO: YYYY-MM-DD
  numero_lot?: string
  quantite: number
  unite: string                 // 'kg', 'pcs', 'L', etc.
  prix_unitaire_ht: number      // en euros
  total_ht?: number
}

export interface InvoiceData {
  fournisseur_nom?: string
  date_facture?: string         // format ISO: YYYY-MM-DD
  numero_facture?: string
  total_ht_facture?: number
  lignes: InvoiceLine[]
}

const INVOICE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    fournisseur_nom: { type: SchemaType.STRING, nullable: true },
    date_facture: { type: SchemaType.STRING, nullable: true, description: 'Format YYYY-MM-DD' },
    numero_facture: { type: SchemaType.STRING, nullable: true },
    total_ht_facture: { type: SchemaType.NUMBER, nullable: true },
    lignes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          designation: { type: SchemaType.STRING },
          dlc: { type: SchemaType.STRING, nullable: true, description: 'Format YYYY-MM-DD' },
          numero_lot: { type: SchemaType.STRING, nullable: true },
          quantite: { type: SchemaType.NUMBER },
          unite: { type: SchemaType.STRING },
          prix_unitaire_ht: { type: SchemaType.NUMBER },
          total_ht: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['designation', 'quantite', 'unite', 'prix_unitaire_ht'],
      },
    },
  },
  required: ['lignes'],
}

export async function extractInvoiceData(imageBase64: string, mimeType: string): Promise<InvoiceData> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: INVOICE_SCHEMA as any,
    },
  })

  const result = await model.generateContent([
    {
      inlineData: { data: imageBase64, mimeType },
    },
    `Tu es un expert en lecture de factures de restauration française.
Extrais toutes les informations de cette facture fournisseur.
Pour chaque ligne de produit, extrais:
- La désignation exacte du produit
- La DLC si visible (date limite de consommation)
- Le numéro de lot si visible
- La quantité et l'unité
- Le prix unitaire HT

Si une information n'est pas visible ou lisible, mets null.
Les prix sont en euros HT.`,
  ])

  const text = result.response.text()
  return JSON.parse(text) as InvoiceData
}

/**
 * Matching fuzzy entre le nom de produit de la facture et les ingrédients du restaurant
 * Retourne l'ingredient_id si trouvé, null sinon
 */
export function matchIngredient(
  designation: string,
  ingredients: { id: string; nom: string }[]
): string | null {
  const needle = designation.toLowerCase().trim()
  
  // Match exact
  const exact = ingredients.find(i => i.nom.toLowerCase() === needle)
  if (exact) return exact.id

  // Match partiel (le nom de l'ingrédient est contenu dans la désignation)
  const partial = ingredients.find(i => needle.includes(i.nom.toLowerCase()))
  if (partial) return partial.id

  // Match inverse (la désignation est contenue dans le nom)
  const reverse = ingredients.find(i => i.nom.toLowerCase().includes(needle))
  if (reverse) return reverse.id

  return null
}
```

### Step 2: Route API process-invoice

```typescript
// app/api/process-invoice/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractInvoiceData, matchIngredient } from '@/lib/ai/invoice-ocr'
import { dishAnalysisLimiter } from '@/lib/upstash'

export const maxDuration = 30 // 30s pour l'OCR

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) {
    return Response.json({ error: 'Restaurant ID requis' }, { status: 400 })
  }

  // Rate limit: 50 OCR/jour/restaurant
  if (dishAnalysisLimiter) {
    const { success, remaining } = await dishAnalysisLimiter.limit(`invoice_ocr:${restaurantId}`)
    if (!success) {
      return Response.json({ error: 'Limite OCR atteinte (50/jour)' }, { status: 429 })
    }
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return Response.json({ error: 'Image requise' }, { status: 400 })
  }

  // Validation type + taille
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Fichier image requis' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: 'Image trop lourde (max 20MB)' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const imageBase64 = Buffer.from(buffer).toString('base64')

  // Extraire données facture
  const invoiceData = await extractInvoiceData(imageBase64, file.type)

  // Récupérer les ingrédients du restaurant pour le matching
  const supabase = createClient()
  const { data: ingredients } = await supabase
    .from('restaurant_ingredients')
    .select('id, nom')
    .eq('restaurant_id', restaurantId)

  // Matcher les lignes de facture avec les ingrédients connus
  const lignesAvecMatch = invoiceData.lignes.map(ligne => ({
    ...ligne,
    ingredient_id: matchIngredient(ligne.designation, ingredients ?? []),
    matched: matchIngredient(ligne.designation, ingredients ?? []) !== null,
  }))

  // Pour les lignes matchées, mettre à jour la mercuriale automatiquement
  // (le trigger recalculate-costs sera déclenché automatiquement)
  const autoUpdates: string[] = []
  for (const ligne of lignesAvecMatch) {
    if (ligne.ingredient_id && ligne.prix_unitaire_ht > 0) {
      // Trouver le fournisseur (on prend le premier si pas précisé)
      const { data: fournisseurs } = await supabase
        .from('fournisseurs')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .ilike('nom', `%${invoiceData.fournisseur_nom?.slice(0, 5) ?? ''}%`)
        .limit(1)

      if (fournisseurs?.[0]) {
        // Désactiver ancien prix actif
        await supabase.from('mercuriale')
          .update({ est_actif: false })
          .eq('ingredient_id', ligne.ingredient_id)
          .eq('restaurant_id', restaurantId)
          .eq('est_actif', true)

        // Insérer nouveau prix
        await supabase.from('mercuriale').insert({
          restaurant_id: restaurantId,
          ingredient_id: ligne.ingredient_id,
          fournisseur_id: fournisseurs[0].id,
          prix: ligne.prix_unitaire_ht,
          unite: ligne.unite || 'kg',
          est_actif: true,
          date_maj: new Date().toISOString(),
        })
        autoUpdates.push(ligne.designation)
      }
    }
  }

  return Response.json({
    invoice: { ...invoiceData, lignes: lignesAvecMatch },
    auto_updated: autoUpdates,
    requires_manual: lignesAvecMatch.filter(l => !l.matched).length,
  })
}
```

### Step 3: Composant InvoiceUpload

```typescript
// components/mercuriale/InvoiceUpload.tsx
'use client'
import { useState, useRef } from 'react'
import { useRestaurantStore } from '@/stores/restaurant'

interface InvoiceResult {
  invoice: any
  auto_updated: string[]
  requires_manual: number
}

interface InvoiceUploadProps {
  onResult: (result: InvoiceResult) => void
}

export function InvoiceUpload({ onResult }: InvoiceUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const restaurantId = useRestaurantStore(s => s.restaurantId)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/process-invoice', {
        method: 'POST',
        headers: { 'x-restaurant-id': restaurantId ?? '' },
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur OCR')
      }
      const result = await res.json()
      onResult(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        data-testid="invoice-upload-input"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-600 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        data-testid="invoice-upload-button"
      >
        {loading ? 'Analyse en cours...' : '📄 Scanner une facture'}
      </button>
      {error && (
        <p className="text-danger text-sm mt-2 text-center">{error}</p>
      )}
    </div>
  )
}
```

### Step 4: Tests

```typescript
// tests/unit/invoice-ocr.test.ts
import { describe, it, expect, vi } from 'vitest'
import { matchIngredient } from '@/lib/ai/invoice-ocr'

describe('matchIngredient', () => {
  const ingredients = [
    { id: '1', nom: 'beurre' },
    { id: '2', nom: 'pomme de terre' },
    { id: '3', nom: 'filet de bœuf' },
  ]

  it('retourne l\'id sur match exact', () => {
    expect(matchIngredient('beurre', ingredients)).toBe('1')
  })

  it('retourne l\'id sur match partiel (ingrédient dans designation)', () => {
    expect(matchIngredient('beurre clarifié fermier', ingredients)).toBe('1')
  })

  it('retourne null si pas de match', () => {
    expect(matchIngredient('tomate cerise', ingredients)).toBeNull()
  })

  it('matching insensible à la casse', () => {
    expect(matchIngredient('BEURRE DOUX', ingredients)).toBe('1')
  })
})
```

## Files to Create

- `lib/ai/invoice-ocr.ts`
- `app/api/process-invoice/route.ts`
- `components/mercuriale/InvoiceUpload.tsx`
- `tests/unit/invoice-ocr.test.ts`

## Files to Modify

- `app/(app)/mercuriale/page.tsx` — intégrer InvoiceUpload + affichage résultat
- `server/routers/commandes.ts` — ajouter `processInvoice` si besoin d'une procédure tRPC

## Contracts

### Provides (pour tâches suivantes)
- `POST /api/process-invoice` → `{ invoice: InvoiceData, auto_updated: string[], requires_manual: number }`
- `matchIngredient(designation, ingredients)` → `string | null`
- Données DLC + lot disponibles pour pré-remplissage réception (Task 5.3)
- Mercuriale automatiquement mise à jour pour les lignes matchées

### Consumes (de Task 3.1)
- `fournisseurs` table (pour trouver le fournisseur)
- `restaurant_ingredients` table (pour le matching)
- `mercuriale` table (pour INSERT prix)

## Acceptance Criteria

- [ ] Upload facture → données extraites affichées en < 5s
- [ ] Prix extrait pour ingrédient connu → mercuriale mise à jour automatiquement
- [ ] DLC et numéro lot extraits → disponibles dans la réponse
- [ ] Ingrédient non reconnu → flag `matched: false` (pas de crash)
- [ ] Rate limit: 429 après 50 OCR/jour
- [ ] `matchIngredient` : exact > partiel > inverse (tests Vitest passent)

## Testing Protocol

### Vitest
```bash
npm run test:unit -- invoice-ocr
```

### Playwright
```typescript
await page.goto('/mercuriale')
await page.click('[data-testid="invoice-upload-button"]')
// Uploader tests/fixtures/invoice-sample.jpg
const input = page.locator('[data-testid="invoice-upload-input"]')
await input.setInputFiles('tests/fixtures/invoice-sample.jpg')
// Attendre résultat
await page.waitForSelector('[data-testid="invoice-result"]', { timeout: 10000 })
```

## Git

- Branch: `phase-3/acheter`
- Commit message prefix: `Task 3.2:`

## PROGRESS.md Update

Marquer Task 3.2 ✅ dans PROGRESS.md.
