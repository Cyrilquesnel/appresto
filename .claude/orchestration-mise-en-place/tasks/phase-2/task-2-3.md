# Task 2.3: Fiche Technique Complète (CRUD + Versioning)

## Objective
Création et gestion complète d'une fiche technique — plat + ingrédients + grammages + photo + allergènes calculés. Versioning automatique à chaque modification.

## Context
La fiche technique est le coeur de l'application. Elle lie un plat à ses ingrédients, calcule les allergènes (union), et déclenche le calcul du coût de revient via la mercuriale. Le versioning permet de tracer les évolutions du plat.

## Dependencies
- Task 2.2 — validation ingrédients opérationnelle, ValidatedIngredient[] disponible

## Blocked By
- Task 2.2

## Implementation Plan

### Step 1: Router tRPC — fiches complet

```typescript
// server/routers/fiches.ts
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

const IngredientLineSchema = z.object({
  ingredient_id: z.string().uuid().optional(),
  nom: z.string().min(1),
  grammage: z.number().positive(),
  unite: z.string().min(1).max(20),
  fournisseur_id_habituel: z.string().uuid().optional(),
  allergenes: z.array(z.string()).default([]),
  is_manual: z.boolean().default(false),
})

export const fichesRouter = router({
  create: protectedProcedure
    .input(z.object({
      plat: z.object({
        nom: z.string().min(1).max(200),
        description: z.string().optional(),
        photo_url: z.string().url().optional(),
        type_plat: z.string().optional(),
        prix_vente_ht: z.number().positive().optional(),
        statut: z.enum(['brouillon', 'actif']).default('brouillon'),
      }),
      ingredients: z.array(IngredientLineSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { plat, ingredients } = input

      // 1. Calculer allergènes (union de tous les ingrédients)
      const allergenesSet = new Set<string>()
      ingredients.forEach(ing => ing.allergenes.forEach(a => allergenesSet.add(a)))
      const allergenes = Array.from(allergenesSet)

      // 2. INSERT plat
      const { data: platData, error: platError } = await ctx.supabase
        .from('plats')
        .insert({
          restaurant_id: ctx.restaurantId,
          nom: plat.nom,
          description: plat.description,
          photo_url: plat.photo_url,
          type_plat: plat.type_plat,
          prix_vente_ht: plat.prix_vente_ht,
          statut: plat.statut,
          allergenes,
        })
        .select('id')
        .single()

      if (platError || !platData) {
        throw new Error(`Erreur création plat: ${platError?.message}`)
      }

      // 3. INSERT fiche_technique lignes
      const lignes = ingredients.map((ing, index) => ({
        restaurant_id: ctx.restaurantId,
        plat_id: platData.id,
        ingredient_id: ing.ingredient_id ?? null,
        nom_ingredient: ing.nom,
        grammage: ing.grammage,
        unite: ing.unite,
        fournisseur_id_habituel: ing.fournisseur_id_habituel ?? null,
        ordre: index,
      }))

      const { error: fichesError } = await ctx.supabase
        .from('fiche_technique')
        .insert(lignes)

      if (fichesError) {
        throw new Error(`Erreur création fiche: ${fichesError.message}`)
      }

      // 4. INSERT fiche_technique_versions (snapshot initial)
      await ctx.supabase.from('fiche_technique_versions').insert({
        restaurant_id: ctx.restaurantId,
        plat_id: platData.id,
        version: 1,
        snapshot: { plat, ingredients, allergenes },
        auteur_id: ctx.user.id,
      })

      return { plat_id: platData.id }
    }),

  get: protectedProcedure
    .input(z.object({ platId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: plat } = await ctx.supabase
        .from('plats')
        .select(`
          *,
          fiche_technique (
            id, nom_ingredient, grammage, unite, ordre,
            ingredient_id, fournisseur_id_habituel
          )
        `)
        .eq('id', input.platId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()

      return plat
    }),

  update: protectedProcedure
    .input(z.object({
      platId: z.string().uuid(),
      plat: z.object({
        nom: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        prix_vente_ht: z.number().positive().optional(),
        statut: z.enum(['brouillon', 'actif']).optional(),
      }).optional(),
      ingredients: z.array(IngredientLineSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { platId, plat, ingredients } = input

      // Vérifier ownership
      const { data: existing } = await ctx.supabase
        .from('plats')
        .select('id')
        .eq('id', platId)
        .eq('restaurant_id', ctx.restaurantId)
        .single()
      if (!existing) throw new Error('Plat non trouvé')

      if (plat) {
        const updateData: any = { ...plat }
        if (ingredients) {
          const allergenesSet = new Set<string>()
          ingredients.forEach(ing => ing.allergenes.forEach(a => allergenesSet.add(a)))
          updateData.allergenes = Array.from(allergenesSet)
        }
        await ctx.supabase.from('plats').update(updateData).eq('id', platId)
      }

      if (ingredients) {
        // Remplacer toutes les lignes fiche_technique
        await ctx.supabase.from('fiche_technique').delete().eq('plat_id', platId)
        const lignes = ingredients.map((ing, index) => ({
          restaurant_id: ctx.restaurantId,
          plat_id: platId,
          ingredient_id: ing.ingredient_id ?? null,
          nom_ingredient: ing.nom,
          grammage: ing.grammage,
          unite: ing.unite,
          ordre: index,
        }))
        await ctx.supabase.from('fiche_technique').insert(lignes)

        // Nouveau snapshot version
        const { count } = await ctx.supabase
          .from('fiche_technique_versions')
          .select('*', { count: 'exact', head: true })
          .eq('plat_id', platId)

        await ctx.supabase.from('fiche_technique_versions').insert({
          restaurant_id: ctx.restaurantId,
          plat_id: platId,
          version: (count ?? 0) + 1,
          snapshot: { plat, ingredients },
          auteur_id: ctx.user.id,
        })
      }

      return { success: true }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('plats')
      .select('id, nom, photo_url, statut, cout_de_revient, allergenes, created_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
    return data ?? []
  }),
})
```

### Step 2: Composant AllergenesDisplay

```typescript
// components/dishes/AllergenesDisplay.tsx
const ALLERGENES_14 = [
  { code: 'gluten', label: 'Gluten', emoji: '🌾' },
  { code: 'crustaces', label: 'Crustacés', emoji: '🦞' },
  { code: 'oeufs', label: 'Œufs', emoji: '🥚' },
  { code: 'poisson', label: 'Poisson', emoji: '🐟' },
  { code: 'arachides', label: 'Arachides', emoji: '🥜' },
  { code: 'soja', label: 'Soja', emoji: '🫘' },
  { code: 'lait', label: 'Lait', emoji: '🥛' },
  { code: 'fruits_coque', label: 'Fruits à coque', emoji: '🌰' },
  { code: 'celeri', label: 'Céleri', emoji: '🥬' },
  { code: 'moutarde', label: 'Moutarde', emoji: '🌿' },
  { code: 'sesame', label: 'Sésame', emoji: '🌱' },
  { code: 'so2', label: 'SO₂/Sulfites', emoji: '🍷' },
  { code: 'lupin', label: 'Lupin', emoji: '🌼' },
  { code: 'mollusques', label: 'Mollusques', emoji: '🦪' },
] as const

interface AllergenesDisplayProps {
  allergenes: string[]
  compact?: boolean
}

export function AllergenesDisplay({ allergenes, compact = false }: AllergenesDisplayProps) {
  const present = ALLERGENES_14.filter(a => allergenes.includes(a.code))

  if (present.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Aucun allergène majeur déclaré
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="allergenes-display">
      {present.map(({ code, label, emoji }) => (
        <span
          key={code}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-warning/10 text-warning border border-warning/30 ${compact ? 'text-xs px-2 py-0.5' : ''}`}
          title={label}
          data-testid={`allergene-${code}`}
        >
          <span>{emoji}</span>
          {!compact && <span>{label}</span>}
        </span>
      ))}
    </div>
  )
}
```

### Step 3: Composant FicheTechniqueForm

```typescript
// components/dishes/FicheTechniqueForm.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { IngredientValidator, ValidatedIngredient } from './IngredientValidator'
import { AllergenesDisplay } from './AllergenesDisplay'

interface FicheTechniqueFormProps {
  initialIngredients?: ValidatedIngredient[]
  photoUrl?: string
  typePlat?: string
}

export function FicheTechniqueForm({ initialIngredients = [], photoUrl, typePlat }: FicheTechniqueFormProps) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)

  const allergenesCalcules = Array.from(
    new Set(ingredients.flatMap(ing => ing.allergenes))
  )

  const createFiche = trpc.fiches.create.useMutation({
    onSuccess: ({ plat_id }) => router.push(`/plats/${plat_id}`),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createFiche.mutate({
      plat: {
        nom,
        photo_url: photoUrl,
        type_plat: typePlat,
        prix_vente_ht: prixVente ? parseFloat(prixVente) : undefined,
        statut: 'brouillon',
      },
      ingredients: ingredients.map(ing => ({
        ingredient_id: ing.id,
        nom: ing.nom,
        grammage: ing.grammage,
        unite: ing.unite,
        allergenes: ing.allergenes,
        is_manual: ing.isManual ?? false,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="fiche-technique-form">
      {photoUrl && (
        <img src={photoUrl} alt="Photo du plat" className="w-full h-48 object-cover rounded-2xl" />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
        <input
          type="text"
          value={nom}
          onChange={e => setNom(e.target.value)}
          required
          placeholder="ex: Magret de canard sauce orange"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
          data-testid="plat-nom-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente HT (€) — optionnel</label>
        <input
          type="number"
          value={prixVente}
          onChange={e => setPrixVente(e.target.value)}
          min={0}
          step={0.01}
          placeholder="ex: 18.50"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
          data-testid="plat-prix-input"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Ingrédients</h3>
        <IngredientValidator
          initialIngredients={ingredients}
          onChange={setIngredients}
        />
      </div>

      {allergenesCalcules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Allergènes détectés</h3>
          <AllergenesDisplay allergenes={allergenesCalcules} />
        </div>
      )}

      <button
        type="submit"
        disabled={!nom || ingredients.length === 0 || createFiche.isPending}
        className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-fiche-button"
      >
        {createFiche.isPending ? 'Enregistrement...' : 'Sauvegarder la fiche'}
      </button>

      {createFiche.isError && (
        <p className="text-danger text-sm text-center">
          Erreur: {createFiche.error.message}
        </p>
      )}
    </form>
  )
}
```

### Step 4: Page liste plats

```typescript
// app/(app)/plats/page.tsx
import { trpc } from '@/lib/trpc/client'

// Version Server Component qui utilise tRPC server-side
// Liste les plats avec: nom, photo, statut, allergènes (badges), cout_de_revient
```

### Step 5: Page fiche technique (detail)

```typescript
// app/(app)/plats/[id]/page.tsx
// Affiche: photo, nom, statut, ingrédients avec grammages, allergènes, cout_de_revient
// Bouton "Modifier la fiche"
```

### Step 6: Tests

```typescript
// tests/unit/fiches.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('fiches.create', () => {
  it('calcule les allergènes comme union de tous les ingrédients', () => {
    const ingredients = [
      { allergenes: ['lait', 'oeufs'] },
      { allergenes: ['gluten', 'lait'] },
      { allergenes: [] },
    ]
    const allergenesSet = new Set<string>()
    ingredients.forEach(ing => ing.allergenes.forEach(a => allergenesSet.add(a)))
    const allergenes = Array.from(allergenesSet)
    expect(allergenes).toContain('lait')
    expect(allergenes).toContain('oeufs')
    expect(allergenes).toContain('gluten')
    expect(allergenes).toHaveLength(3) // pas de doublon
  })
})
```

## Files to Create

- `server/routers/fiches.ts` (complet)
- `components/dishes/FicheTechniqueForm.tsx`
- `components/dishes/AllergenesDisplay.tsx`
- `app/(app)/plats/[id]/page.tsx`
- `tests/unit/fiches.test.ts`

## Files to Modify

- `server/routers/index.ts` — importer fichesRouter
- `app/(app)/plats/page.tsx` — liste complète
- `app/(app)/plats/nouveau/page.tsx` — étape 3 finale (FicheTechniqueForm)

## Contracts

### Provides (pour tâches suivantes)
- `trpc.fiches.create({ plat, ingredients })` → `{ plat_id }`
- `trpc.fiches.get({ platId })` → fiche complète
- `trpc.fiches.list()` → liste plats
- `trpc.fiches.update({ platId, plat?, ingredients? })` → met à jour + crée version
- `AllergenesDisplay` composant réutilisable

### Consumes (de Task 2.2)
- `ValidatedIngredient[]` depuis IngredientValidator
- `trpc.plats.searchIngredients` pour la recherche

## Acceptance Criteria

- [ ] Créer fiche technique avec 3+ ingrédients → plat dans la liste
- [ ] Allergènes calculés correctement (union, pas de doublons)
- [ ] `fiche_technique_versions` contient snapshot après création (vérifier en BDD)
- [ ] Photo du plat affichée dans la fiche
- [ ] `cout_de_revient = null` si pas de prix mercuriale (pas d'erreur)
- [ ] Modifier fiche → nouveau snapshot créé
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- fiches
```

### Playwright
```typescript
// Créer fiche technique complète
await page.fill('[data-testid="plat-nom-input"]', 'Steak frites')
// ... ajouter ingrédients
await page.click('[data-testid="save-fiche-button"]')
await expect(page).toHaveURL(/\/plats\//)

// Vérifier allergènes affichés
await expect(page.locator('[data-testid="allergenes-display"]')).toBeVisible()
```

### SQL
```sql
-- Vérifier version créée après INSERT
SELECT * FROM fiche_technique_versions WHERE plat_id = 'plat-id';
```

## Git

- Branch: `phase-2/operer`
- Commit message prefix: `Task 2.3:`

## PROGRESS.md Update

Marquer Task 2.3 ✅ dans PROGRESS.md.
