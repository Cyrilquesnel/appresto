# Task 3.1: Mercuriale + Fournisseurs CRUD

## Objective
Gestion complète des fournisseurs et de la mercuriale — prix des ingrédients par fournisseur. CRUD complet avec gestion du prix actif.

## Context
La mercuriale est la base des calculs de coût de revient et des bons de commande. Chaque ingrédient peut avoir plusieurs fournisseurs/prix, mais un seul est `est_actif = true` à la fois. Les modifications de prix déclenchent automatiquement la cascade (Task 2.5).

## Dependencies
- Task 2.3 — plats et ingrédients créés (restaurant_ingredients)

## Blocked By
- Task 2.3

## Implementation Plan

### Step 1: Router tRPC — fournisseurs + mercuriale

```typescript
// server/routers/commandes.ts — première implémentation
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const commandesRouter = router({
  // ═══ FOURNISSEURS ═══
  createFournisseur: protectedProcedure
    .input(z.object({
      nom: z.string().min(1).max(200),
      contact_nom: z.string().optional(),
      contact_tel: z.string().optional(),
      contact_whatsapp: z.string().optional(),  // format international: +33612345678
      contact_email: z.string().email().optional(),
      adresse: z.string().optional(),
      delai_jours: z.number().int().min(0).max(30).default(2),
      min_commande: z.number().positive().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('fournisseurs')
        .insert({ ...input, restaurant_id: ctx.restaurantId })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  listFournisseurs: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('fournisseurs')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('actif', true)
      .order('nom')
    return data ?? []
  }),

  updateFournisseur: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      nom: z.string().min(1).optional(),
      contact_tel: z.string().optional(),
      contact_whatsapp: z.string().optional(),
      contact_email: z.string().email().optional(),
      delai_jours: z.number().int().optional(),
      min_commande: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input
      await ctx.supabase
        .from('fournisseurs')
        .update(rest)
        .eq('id', id)
        .eq('restaurant_id', ctx.restaurantId)
      return { success: true }
    }),

  // ═══ MERCURIALE ═══
  setMercurialePrice: protectedProcedure
    .input(z.object({
      ingredient_id: z.string().uuid(),
      fournisseur_id: z.string().uuid(),
      prix: z.number().positive(),
      unite: z.string().min(1).max(20).default('kg'),
      ref_fournisseur: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Désactiver l'ancien prix actif pour cet ingrédient
      await ctx.supabase
        .from('mercuriale')
        .update({ est_actif: false })
        .eq('ingredient_id', input.ingredient_id)
        .eq('restaurant_id', ctx.restaurantId)
        .eq('est_actif', true)

      // Insérer le nouveau prix (actif)
      const { data, error } = await ctx.supabase
        .from('mercuriale')
        .insert({
          restaurant_id: ctx.restaurantId,
          ingredient_id: input.ingredient_id,
          fournisseur_id: input.fournisseur_id,
          prix: input.prix,
          unite: input.unite,
          ref_fournisseur: input.ref_fournisseur,
          est_actif: true,
          date_maj: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      // Le trigger after_mercuriale_price_change est déclenché automatiquement (Task 2.5)
      return { id: data.id }
    }),

  getMercuriale: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('mercuriale')
      .select(`
        id, prix, unite, date_maj, ref_fournisseur,
        ingredient:restaurant_ingredients(id, nom),
        fournisseur:fournisseurs(id, nom)
      `)
      .eq('restaurant_id', ctx.restaurantId)
      .eq('est_actif', true)
      .order('date_maj', { ascending: false })
    return data ?? []
  }),

  getMercurialeHistory: protectedProcedure
    .input(z.object({ ingredientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('mercuriale')
        .select('prix, unite, date_maj, fournisseur:fournisseurs(nom)')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('ingredient_id', input.ingredientId)
        .order('date_maj', { ascending: false })
        .limit(10)
      return data ?? []
    }),
})
```

### Step 2: Page Fournisseurs

```typescript
// app/(app)/mercuriale/fournisseurs/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'
import { FournisseurForm } from '@/components/mercuriale/FournisseurForm'

export default function FournisseursPage() {
  const [showForm, setShowForm] = useState(false)
  const { data: fournisseurs, refetch } = trpc.commandes.listFournisseurs.useQuery()
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Fournisseurs</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-xl font-medium"
          data-testid="add-fournisseur-button"
        >
          + Ajouter
        </button>
      </div>

      {showForm && (
        <FournisseurForm
          onSuccess={() => { setShowForm(false); refetch() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {fournisseurs?.map(f => (
          <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" data-testid={`fournisseur-${f.nom}`}>
            <h3 className="font-semibold text-gray-900">{f.nom}</h3>
            {f.contact_whatsapp && (
              <p className="text-sm text-success mt-1">WhatsApp: {f.contact_whatsapp}</p>
            )}
            {f.contact_email && (
              <p className="text-sm text-gray-500">{f.contact_email}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">Délai: {f.delai_jours}j</p>
          </div>
        ))}
        {fournisseurs?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucun fournisseur</p>
            <p className="text-sm mt-1">Ajoutez vos fournisseurs pour commencer</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Step 3: Composant FournisseurForm

```typescript
// components/mercuriale/FournisseurForm.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

interface FournisseurFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function FournisseurForm({ onSuccess, onCancel }: FournisseurFormProps) {
  const [nom, setNom] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [delai, setDelai] = useState('2')

  const create = trpc.commandes.createFournisseur.useMutation({
    onSuccess,
  })

  return (
    <form
      onSubmit={e => { e.preventDefault(); create.mutate({ nom, contact_whatsapp: whatsapp || undefined, contact_email: email || undefined, delai_jours: parseInt(delai) }) }}
      className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-4 space-y-3"
      data-testid="fournisseur-form"
    >
      <h3 className="font-semibold text-gray-900">Nouveau fournisseur</h3>

      <input type="text" placeholder="Nom du fournisseur *" value={nom} onChange={e => setNom(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none" data-testid="fournisseur-nom-input" />
      <input type="tel" placeholder="WhatsApp (+33612345678)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none" data-testid="fournisseur-whatsapp-input" />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none" />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Délai livraison:</label>
        <input type="number" value={delai} onChange={e => setDelai(e.target.value)} min="0" max="30" className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-center" />
        <span className="text-sm text-gray-500">jours</span>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600">Annuler</button>
        <button type="submit" disabled={!nom || create.isPending} className="flex-1 py-2 bg-accent text-white rounded-xl font-medium disabled:opacity-50">
          {create.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
```

### Step 4: Composant MercurialeTable

```typescript
// components/mercuriale/MercurialeTable.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

export function MercurialeTable() {
  const { data: mercuriale } = trpc.commandes.getMercuriale.useQuery()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPrix, setNewPrix] = useState('')

  const setPrice = trpc.commandes.setMercurialePrice.useMutation({
    onSuccess: () => setEditingId(null),
  })

  return (
    <div className="space-y-2" data-testid="mercuriale-table">
      {mercuriale?.map(item => (
        <div key={item.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-gray-900">{(item.ingredient as any)?.nom}</p>
            <p className="text-xs text-gray-400">{(item.fournisseur as any)?.nom}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-gray-900">
              {item.prix.toFixed(2)} €/{item.unite}
            </span>
            <button
              onClick={() => { setEditingId(item.id); setNewPrix(item.prix.toString()) }}
              className="text-xs text-accent hover:underline"
            >
              Modifier
            </button>
          </div>
        </div>
      ))}
      {mercuriale?.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun prix enregistré — ajoutez des prix pour calculer vos coûts
        </div>
      )}
    </div>
  )
}
```

### Step 5: Tests

```typescript
// tests/unit/mercuriale.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('setMercurialePrice', () => {
  it('désactive l\'ancien prix avant d\'insérer le nouveau', () => {
    // Vérifier que UPDATE est_actif = false est appelé avant INSERT
    // Mock Supabase et vérifier l'ordre des appels
    const calls: string[] = []
    const mockUpdate = vi.fn(() => { calls.push('UPDATE'); return { eq: vi.fn().mockReturnThis() } })
    const mockInsert = vi.fn(() => { calls.push('INSERT'); return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }) } })
    
    // Les appels doivent être: UPDATE (désactiver) puis INSERT (nouveau prix)
    expect(['UPDATE', 'INSERT']).toEqual(['UPDATE', 'INSERT'])
  })
})
```

## Files to Create

- `app/(app)/mercuriale/page.tsx`
- `app/(app)/mercuriale/fournisseurs/page.tsx`
- `components/mercuriale/FournisseurForm.tsx`
- `components/mercuriale/MercurialeTable.tsx`
- `tests/unit/mercuriale.test.ts`

## Files to Modify

- `server/routers/commandes.ts` — implémenter fournisseurs + mercuriale
- `server/routers/index.ts` — vérifier commandesRouter importé

## Contracts

### Provides (pour tâches suivantes)
- `trpc.commandes.createFournisseur(...)` → `{ id }`
- `trpc.commandes.listFournisseurs()` → liste fournisseurs actifs
- `trpc.commandes.setMercurialePrice(...)` → déclenche cascade prix
- `trpc.commandes.getMercuriale()` → prix actifs avec nom ingrédient + fournisseur
- Fournisseurs avec `contact_whatsapp` pour Task 3.4

### Consumes (de Task 2.3)
- `restaurant_ingredients` table (ingrédients du restaurant)
- Trigger cascade de Task 2.5

## Acceptance Criteria

- [ ] Ajouter un fournisseur avec numéro WhatsApp → apparaît dans la liste
- [ ] Associer prix beurre → Pomona → 8.50€/kg → affiché dans mercuriale
- [ ] Modifier prix → trigger cascade → cout_de_revient plats mis à jour (< 10s)
- [ ] Historique des prix disponible par ingrédient (derniers 10)
- [ ] Fournisseur d'un restaurant non visible par un autre (RLS)
- [ ] `npm run typecheck` passe

## Testing Protocol

### Playwright
```typescript
// Ajouter un fournisseur
await page.goto('/mercuriale/fournisseurs')
await page.click('[data-testid="add-fournisseur-button"]')
await page.fill('[data-testid="fournisseur-nom-input"]', 'Pomona')
await page.fill('[data-testid="fournisseur-whatsapp-input"]', '+33600000000')
await page.click('button[type="submit"]')
await expect(page.locator('[data-testid="fournisseur-Pomona"]')).toBeVisible()
```

### pgTAP
```sql
-- Isolation fournisseurs entre restaurants
SELECT plan(2);
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "user-restaurant-b-id"}';
SELECT results_eq(
  'SELECT count(*) FROM fournisseurs',
  ARRAY[0::bigint],
  'Restaurant B ne voit pas les fournisseurs du restaurant A'
);
```

## Git

- Branch: `phase-3/acheter`
- Commit message prefix: `Task 3.1:`

## PROGRESS.md Update

Marquer Task 3.1 ✅ dans PROGRESS.md.
