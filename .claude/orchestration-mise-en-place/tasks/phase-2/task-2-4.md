# Task 2.4: Enrichissement Claude Haiku — Allergènes + Grammages

## Objective
Enrichissement automatique des ingrédients via Claude Haiku 4.5 (allergènes précis, grammages typiques, kcal). Appelé uniquement si la confiance Gemini globale < 0.65.

## Context
Pipeline en 2 étapes : Gemini (rapide, vision) → Claude Haiku (texte, enrichissement précis si nécessaire). L'enrichissement est conditionnel pour économiser les coûts. Le prompt system est mis en cache (cache_control) pour réduire les tokens facturés.

## Dependencies
- Task 2.1 — pipeline Gemini opérationnel, confiance_globale disponible dans la réponse

## Blocked By
- Task 2.1

## Implementation Plan

### Step 1: lib/ai/claude-enrichment.ts

```typescript
// lib/ai/claude-enrichment.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface EnrichedIngredient {
  allergenes_confirmes: string[]
  grammage_portion: number    // en grammes
  kcal_par_100g: number
  unite_standard: string      // 'g' | 'ml' | 'pièce'
  notes?: string
}

export type EnrichmentResult = Record<string, EnrichedIngredient>

const SYSTEM_PROMPT = `Tu es un expert culinaire et nutritionniste spécialisé dans la réglementation alimentaire française. 
Pour chaque ingrédient donné, retourne en JSON :
- allergenes_confirmes: liste des codes allergènes parmi ['gluten','crustaces','oeufs','poisson','arachides','soja','lait','fruits_coque','celeri','moutarde','sesame','so2','lupin','mollusques'] (liste vide si aucun)
- grammage_portion: grammage typique en grammes pour une portion restaurant standard
- kcal_par_100g: calories pour 100g (estimation)
- unite_standard: 'g' pour solides, 'ml' pour liquides, 'pièce' pour unitaires
- notes: remarque culinaire ou sanitaire importante (optionnel)

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.`

export async function enrichIngredients(
  ingredientNames: string[],
  timeoutMs = 10000
): Promise<EnrichmentResult> {
  if (ingredientNames.length === 0) return {}

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            // Cache le system prompt pour économiser les tokens
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Enrichis ces ingrédients: ${JSON.stringify(ingredientNames)}

Réponds avec un objet JSON où chaque clé est le nom de l'ingrédient.`,
          },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text) as EnrichmentResult
    return parsed
  } catch (error) {
    clearTimeout(timeoutId)

    if ((error as Error).name === 'AbortError') {
      console.warn('[claude-enrichment] Timeout après', timeoutMs, 'ms — enrichissement ignoré')
      return {}
    }

    console.error('[claude-enrichment] Erreur:', error)
    return {} // Dégradé gracieusement — pipeline continue sans enrichissement
  }
}

/**
 * Détermine si l'enrichissement Claude est nécessaire.
 * Appeler uniquement si confiance_globale < 0.65 ou si des ingrédients individuels ont confiance < 0.65
 */
export function shouldEnrich(
  confianceGlobale: number,
  ingredientsConfiance: number[]
): boolean {
  if (confianceGlobale < 0.65) return true
  return ingredientsConfiance.some(c => c < 0.65)
}
```

### Step 2: Intégration dans app/api/analyze-dish/route.ts

```typescript
// app/api/analyze-dish/route.ts — modifier pour intégrer enrichissement

import { enrichIngredients, shouldEnrich } from '@/lib/ai/claude-enrichment'

// Après l'analyse Gemini, dans la même route :
const geminiResult = await analyzeWithRetry(imageBase64, mimeType)

// Vérifier si enrichissement nécessaire
const ingredientsConfiance = geminiResult.ingredients_detectes.map(i => i.confiance)
const needsEnrichment = shouldEnrich(geminiResult.confiance_globale, ingredientsConfiance)

let enrichedData: Record<string, any> = {}
if (needsEnrichment) {
  const lowConfidenceNames = geminiResult.ingredients_detectes
    .filter(i => i.confiance < 0.65)
    .map(i => i.nom)

  enrichedData = await enrichIngredients(lowConfidenceNames)
}

// Fusionner: enrichissement complète les données Gemini
const ingredients = geminiResult.ingredients_detectes.map(ing => ({
  ...ing,
  allergenes: enrichedData[ing.nom]?.allergenes_confirmes ?? ing.allergenes ?? [],
  grammage_suggere: enrichedData[ing.nom]?.grammage_portion ?? ing.grammage_suggere,
  kcal_par_100g: enrichedData[ing.nom]?.kcal_par_100g,
}))

return Response.json({
  type_plat: geminiResult.type_plat,
  ingredients,
  confiance_globale: geminiResult.confiance_globale,
  enrichissement_utilise: needsEnrichment,
  analyses_restantes, // depuis Upstash
  image_url, // depuis Storage
})
```

### Step 3: Tests unitaires

```typescript
// tests/unit/claude-enrichment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldEnrich } from '@/lib/ai/claude-enrichment'

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            'bœuf': {
              allergenes_confirmes: [],
              grammage_portion: 180,
              kcal_par_100g: 250,
              unite_standard: 'g',
            }
          }),
        }],
      }),
    },
  })),
}))

describe('shouldEnrich', () => {
  it('retourne true si confiance_globale < 0.65', () => {
    expect(shouldEnrich(0.60, [0.8, 0.9])).toBe(true)
  })

  it('retourne true si un ingrédient a confiance < 0.65', () => {
    expect(shouldEnrich(0.80, [0.9, 0.50, 0.85])).toBe(true)
  })

  it('retourne false si tout est > 0.65', () => {
    expect(shouldEnrich(0.90, [0.80, 0.85, 0.95])).toBe(false)
  })
})

describe('enrichIngredients', () => {
  it('retourne un objet vide si aucun ingrédient', async () => {
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    const result = await enrichIngredients([])
    expect(result).toEqual({})
  })

  it('retourne résultat enrichi pour un ingrédient', async () => {
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    const result = await enrichIngredients(['bœuf'])
    expect(result['bœuf']).toBeDefined()
    expect(result['bœuf'].allergenes_confirmes).toBeInstanceOf(Array)
  })

  it('retourne objet vide sur timeout (dégradé gracieux)', async () => {
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    // timeout de 1ms → simuler timeout
    const result = await enrichIngredients(['bœuf'], 1)
    expect(result).toEqual({})
  })

  it('vérifie que cache_control est configuré dans le payload', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    })
    ;(Anthropic as any).mockImplementation(() => ({
      messages: { create: mockCreate },
    }))

    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    await enrichIngredients(['test'])

    const callArgs = mockCreate.mock.calls[0][0]
    const systemBlock = callArgs.system[0]
    expect(systemBlock.cache_control).toBeDefined()
    expect(systemBlock.cache_control.type).toBe('ephemeral')
  })
})
```

## Files to Create

- `lib/ai/claude-enrichment.ts`
- `tests/unit/claude-enrichment.test.ts`

## Files to Modify

- `app/api/analyze-dish/route.ts` — intégrer enrichissement conditionnel après Gemini
- `tests/mocks/anthropic.ts` — vérifier que le mock correspond au vrai SDK

## Contracts

### Provides (pour tâches suivantes)
- `enrichIngredients(names, timeoutMs?)` → `EnrichmentResult` (ou `{}` si timeout)
- `shouldEnrich(globalConf, itemConfs)` → `boolean`
- `/api/analyze-dish` retourne `enrichissement_utilise: boolean`

### Consumes (de Task 2.1)
- `confiance_globale` depuis Gemini
- Tableau `ingredients_detectes[].confiance` depuis Gemini
- Pipeline Gemini dans `/api/analyze-dish`

## Acceptance Criteria

- [ ] Analyse avec confiance < 0.65 → enrichissement Claude déclenché
- [ ] Analyse avec confiance > 0.65 → Claude NON appelé (vérifier via log)
- [ ] Allergènes enrichis conformes aux 14 allergènes EU
- [ ] Timeout 10s → pipeline continue sans crasher (retourne données Gemini seules)
- [ ] Coût total pipeline < $0.005 par analyse (estimer sur Anthropic dashboard)
- [ ] `cache_control: { type: 'ephemeral' }` présent sur le system prompt
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- claude-enrichment
```

Vérifier:
- `shouldEnrich` logique correcte
- Enrichissement appelé seulement si nécessaire
- Timeout → retourne `{}`
- `cache_control` configuré

### Coût estimation
Après 10 analyses test : vérifier dashboard Anthropic → coût < $0.05 total

## Git

- Branch: `phase-2/operer`
- Commit message prefix: `Task 2.4:`

## PROGRESS.md Update

Marquer Task 2.4 ✅ dans PROGRESS.md.
