# Task 2.2: Validation et Correction Ingrédients (UI)

## Objective
Interface de validation des ingrédients détectés par Gemini — le restaurateur peut corriger noms, quantités, supprimer/ajouter des ingrédients. Recherche full-text dans le catalogue.

## Context
Après l'analyse Gemini (Task 2.1), le restaurateur voit la liste d'ingrédients détectés et peut la corriger avant de créer la fiche technique. C'est l'étape de validation humaine du pipeline IA.

## Dependencies
- Task 2.1 — pipeline Gemini opérationnel, résultat `DetectedIngredient[]` disponible

## Blocked By
- Task 2.1

## Implementation Plan

### Step 1: Router tRPC — searchIngredients

```typescript
// server/routers/plats.ts — ajouter/compléter
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const platsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('plats')
      .select('*, fiche_technique(count)')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
    return data ?? []
  }),

  searchIngredients: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(100),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .rpc('search_ingredients', {
          p_query: input.query,
          p_restaurant_id: ctx.restaurantId,
          p_limit: input.limit,
        })
      return data ?? []
    }),
})
```

### Step 2: Composant IngredientSearch

```typescript
// components/dishes/IngredientSearch.tsx
'use client'
import { useState, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { trpc } from '@/lib/trpc/client'

interface IngredientSearchProps {
  onSelect: (ingredient: { id: string; nom: string; allergenes: string[] }) => void
  placeholder?: string
}

export function IngredientSearch({ onSelect, placeholder = 'Rechercher un ingrédient...' }: IngredientSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data: results, isLoading } = trpc.plats.searchIngredients.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
        data-testid="ingredient-search-input"
      />
      {isLoading && (
        <div className="absolute right-3 top-3 text-gray-400 text-sm">...</div>
      )}
      {results && results.length > 0 && query.length >= 2 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.map((item: any) => (
            <li
              key={item.id}
              onClick={() => {
                onSelect({ id: item.id, nom: item.nom, allergenes: item.allergenes ?? [] })
                setQuery('')
              }}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              data-testid={`ingredient-suggestion-${item.nom}`}
            >
              <span className="text-gray-900">{item.nom}</span>
              <span className="text-xs text-gray-400 capitalize">{item.source}</span>
            </li>
          ))}
        </ul>
      )}
      {results?.length === 0 && debouncedQuery.length >= 2 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow p-3 text-sm text-gray-500">
          Aucun résultat — l'ingrédient sera créé manuellement
        </div>
      )}
    </div>
  )
}
```

### Step 3: Hook useDebounce

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

### Step 4: Composant IngredientValidator

```typescript
// components/dishes/IngredientValidator.tsx
'use client'
import { useState } from 'react'
import { IngredientSearch } from './IngredientSearch'

export interface ValidatedIngredient {
  id?: string               // catalog_id ou restaurant_ingredient_id
  nom: string
  grammage: number
  unite: string
  allergenes: string[]
  confiance?: number
  isManual?: boolean
}

interface IngredientValidatorProps {
  initialIngredients: ValidatedIngredient[]
  onChange: (ingredients: ValidatedIngredient[]) => void
}

export function IngredientValidator({ initialIngredients, onChange }: IngredientValidatorProps) {
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)
  const [showSearch, setShowSearch] = useState(false)

  const update = (updated: ValidatedIngredient[]) => {
    setIngredients(updated)
    onChange(updated)
  }

  const remove = (index: number) => {
    update(ingredients.filter((_, i) => i !== index))
  }

  const updateGrammage = (index: number, grammage: number) => {
    update(ingredients.map((ing, i) => i === index ? { ...ing, grammage } : ing))
  }

  const addManual = (ingredient: { id: string; nom: string; allergenes: string[] }) => {
    const newIng: ValidatedIngredient = {
      id: ingredient.id,
      nom: ingredient.nom,
      grammage: 100,
      unite: 'g',
      allergenes: ingredient.allergenes,
      isManual: true,
    }
    update([...ingredients, newIng])
    setShowSearch(false)
  }

  return (
    <div className="space-y-3" data-testid="ingredient-validator">
      {ingredients.map((ing, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
          data-testid={`ingredient-row-${index}`}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{ing.nom}</p>
            {ing.allergenes.length > 0 && (
              <p className="text-xs text-warning truncate">
                Allergènes: {ing.allergenes.join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              value={ing.grammage}
              onChange={(e) => updateGrammage(index, Number(e.target.value))}
              min={1}
              className="w-20 px-2 py-1 text-center border border-gray-200 rounded-lg text-sm"
              data-testid={`ingredient-grammage-${index}`}
            />
            <span className="text-xs text-gray-500">{ing.unite}</span>
            <button
              onClick={() => remove(index)}
              className="p-1 text-danger hover:bg-red-50 rounded-lg"
              aria-label={`Supprimer ${ing.nom}`}
              data-testid={`ingredient-remove-${index}`}
            >
              ✕
            </button>
          </div>
          {ing.confiance && ing.confiance < 0.65 && (
            <span className="text-xs text-warning ml-1" title="Confiance faible">⚠</span>
          )}
        </div>
      ))}

      {showSearch ? (
        <div className="relative">
          <IngredientSearch
            onSelect={addManual}
            placeholder="Rechercher un ingrédient à ajouter..."
          />
          <button
            onClick={() => setShowSearch(false)}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-accent hover:text-accent transition-colors"
          data-testid="add-ingredient-button"
        >
          + Ajouter un ingrédient
        </button>
      )}
    </div>
  )
}
```

### Step 5: Mise à jour page création plat (étape validation)

```typescript
// app/(app)/plats/nouveau/page.tsx — étape 2: validation ingrédients
// Après l'analyse Gemini (étape 1), afficher IngredientValidator
// Conserver l'état entre étapes via useState (ou URL search params)

// Exemple de state machine par étapes:
// step 1: upload photo → analyser
// step 2: valider ingrédients (IngredientValidator)
// step 3: nommer le plat + métadonnées → créer fiche

// Passer initialIngredients depuis la réponse API analyze-dish
// mappage : DetectedIngredient[] → ValidatedIngredient[]
```

### Step 6: Tests unitaires

```typescript
// tests/unit/search-ingredients.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabaseClient(),
}))

describe('plats.searchIngredients', () => {
  it('returns results sorted by source (restaurant before catalog)', async () => {
    // Test que les ingrédients du restaurant apparaissent avant le catalogue global
    const mockResults = [
      { id: '1', nom: 'beurre clarifié', source: 'restaurant', allergenes: ['lait'] },
      { id: '2', nom: 'beurre doux', source: 'catalog', allergenes: ['lait'] },
    ]
    // Vérifier ordre: restaurant > catalog
    expect(mockResults[0].source).toBe('restaurant')
    expect(mockResults[1].source).toBe('catalog')
  })

  it('returns empty array when no results', async () => {
    const results: any[] = []
    expect(results).toHaveLength(0)
  })
})
```

## Files to Create

- `components/dishes/IngredientSearch.tsx`
- `components/dishes/IngredientValidator.tsx`
- `hooks/useDebounce.ts`
- `tests/unit/search-ingredients.test.ts`

## Files to Modify

- `server/routers/plats.ts` — compléter `searchIngredients` + `list` avec join fiche_technique
- `app/(app)/plats/nouveau/page.tsx` — ajouter étape 2 (IngredientValidator)

## Contracts

### Provides (pour tâches suivantes)
- `trpc.plats.searchIngredients({ query, limit })` → `{ id, nom, source, allergenes, score }[]`
- `IngredientValidator` composant avec `ValidatedIngredient[]` en sortie
- `useDebounce` hook réutilisable

### Consumes (de Task 2.1)
- Réponse `DetectedIngredient[]` de `/api/analyze-dish`
- Fonction SQL `search_ingredients()` définie en Task 1.2

## Acceptance Criteria

- [ ] L'utilisateur peut supprimer un ingrédient détecté
- [ ] L'utilisateur peut modifier le grammage d'un ingrédient
- [ ] Recherche "beurre" retourne résultats en < 500ms
- [ ] Ingrédient non trouvé → peut être ajouté manuellement (isManual: true)
- [ ] Modifications conservées lors de la navigation entre étapes
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- search-ingredients
```

### Playwright
```typescript
// Rechercher "beurre" → suggestions visibles en < 500ms
await page.fill('[data-testid="ingredient-search-input"]', 'beurre')
await page.waitForSelector('[data-testid^="ingredient-suggestion-"]', { timeout: 500 })

// Modifier grammage
await page.fill('[data-testid="ingredient-grammage-0"]', '200')
await expect(page.locator('[data-testid="ingredient-grammage-0"]')).toHaveValue('200')

// Supprimer ingrédient
await page.click('[data-testid="ingredient-remove-0"]')
```

## Git

- Branch: `phase-2/operer`
- Commit message prefix: `Task 2.2:`

## PROGRESS.md Update

Marquer Task 2.2 ✅ dans PROGRESS.md.
