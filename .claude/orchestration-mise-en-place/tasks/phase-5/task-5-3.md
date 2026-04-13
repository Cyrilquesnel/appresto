# Task 5.3: Réceptions Marchandises

## Objective
Enregistrement des réceptions fournisseurs avec DLC, numéros lot, température réception. Pré-rempli depuis l'OCR factures si disponible.

## Context
Les réceptions sont la traçabilité des entrées de marchandises. Pour la viande bovine, la traçabilité est obligatoire pendant 5 ans. Le formulaire peut être pré-rempli depuis les données extraites par OCR (Task 3.2).

## Dependencies
- Task 3.2 — OCR factures disponible (DLC + lot)
- Task 5.1 — pmsRouter opérationnel

## Blocked By
- Tasks 3.2 + 5.1

## Implementation Plan

### Step 1: Router tRPC — réceptions

```typescript
// server/routers/pms.ts — ajouter dans pmsRouter

// ═══ RÉCEPTIONS ═══
createReception: protectedProcedure
  .input(z.object({
    fournisseur_id: z.string().uuid(),
    date_reception: z.string(),           // ISO date
    numero_bl: z.string().optional(),     // Numéro bon de livraison
    bon_de_commande_id: z.string().uuid().optional(),
    items: z.array(z.object({
      ingredient_id: z.string().uuid(),
      nom_produit: z.string().min(1),
      quantite: z.number().positive(),
      unite: z.string().min(1),
      dlc: z.string().optional(),          // ISO date YYYY-MM-DD
      numero_lot: z.string().optional(),
      temperature_reception: z.number().optional(),
      conforme: z.boolean().default(true),
      anomalie_description: z.string().optional(),
    })),
    statut: z.enum(['conforme', 'anomalie', 'refuse']).default('conforme'),
  }))
  .mutation(async ({ ctx, input }) => {
    // Vérifier si items non-conformes ont une description d'anomalie
    const nonConformes = input.items.filter(i => !i.conforme)
    const sanDescription = nonConformes.filter(i => !i.anomalie_description)
    if (sanDescription.length > 0) {
      throw new Error('Description d\'anomalie obligatoire pour les items non-conformes')
    }

    // Déterminer statut global
    const hasAnomalie = input.items.some(i => !i.conforme)
    const statut = hasAnomalie ? 'anomalie' : input.statut

    // INSERT réception
    const { data: reception, error } = await ctx.supabase
      .from('receptions')
      .insert({
        restaurant_id: ctx.restaurantId,
        fournisseur_id: input.fournisseur_id,
        date_reception: input.date_reception,
        numero_bl: input.numero_bl,
        bon_de_commande_id: input.bon_de_commande_id,
        statut,
        receptionne_par: ctx.user.id,
      })
      .select('id')
      .single()

    if (error || !reception) throw new Error(error?.message)

    // INSERT items de réception
    const { error: itemsError } = await ctx.supabase
      .from('reception_items')
      .insert(
        input.items.map(item => ({
          reception_id: reception.id,
          restaurant_id: ctx.restaurantId,
          ingredient_id: item.ingredient_id,
          nom_produit: item.nom_produit,
          quantite: item.quantite,
          unite: item.unite,
          dlc: item.dlc,
          numero_lot: item.numero_lot,
          temperature_reception: item.temperature_reception,
          conforme: item.conforme,
          anomalie_description: item.anomalie_description,
        }))
      )

    if (itemsError) throw new Error(itemsError.message)

    // Si bon de commande associé → mettre à jour statut
    if (input.bon_de_commande_id) {
      await ctx.supabase
        .from('bons_de_commande')
        .update({ statut: 'recu' })
        .eq('id', input.bon_de_commande_id)
        .eq('restaurant_id', ctx.restaurantId)
    }

    return { id: reception.id, statut }
  }),

getReceptions: protectedProcedure
  .input(z.object({
    fournisseur_id: z.string().uuid().optional(),
    jours: z.number().int().min(1).max(365).default(30),
  }))
  .query(async ({ ctx, input }) => {
    const dateDebut = new Date()
    dateDebut.setDate(dateDebut.getDate() - input.jours)

    let query = ctx.supabase
      .from('receptions')
      .select(`
        *,
        fournisseur:fournisseurs(nom),
        items:reception_items(*)
      `)
      .eq('restaurant_id', ctx.restaurantId)
      .gte('date_reception', dateDebut.toISOString().split('T')[0])
      .order('date_reception', { ascending: false })

    if (input.fournisseur_id) {
      query = query.eq('fournisseur_id', input.fournisseur_id)
    }

    const { data } = await query
    return data ?? []
  }),
```

### Step 2: Composant ReceptionForm

```typescript
// components/pms/ReceptionForm.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface ReceptionItem {
  ingredient_id: string
  nom_produit: string
  quantite: number
  unite: string
  dlc?: string
  numero_lot?: string
  temperature_reception?: number
  conforme: boolean
  anomalie_description?: string
}

interface ReceptionFormProps {
  initialItems?: ReceptionItem[]  // pré-rempli depuis OCR
  fournisseurId?: string
  onSuccess: (id: string) => void
}

export function ReceptionForm({ initialItems = [], fournisseurId, onSuccess }: ReceptionFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedFournisseur, setSelectedFournisseur] = useState(fournisseurId ?? '')
  const [dateReception, setDateReception] = useState(today)
  const [numeroBL, setNumeroBL] = useState('')
  const [items, setItems] = useState<ReceptionItem[]>(initialItems)

  const { data: fournisseurs } = trpc.commandes.listFournisseurs.useQuery()
  const createReception = trpc.pms.createReception.useMutation({
    onSuccess: (data) => onSuccess(data.id),
  })

  const updateItem = (index: number, updates: Partial<ReceptionItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  const isDLCAlerte = (dlc?: string) => {
    if (!dlc) return false
    return new Date(dlc) <= new Date()
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        createReception.mutate({
          fournisseur_id: selectedFournisseur,
          date_reception: dateReception,
          numero_bl: numeroBL || undefined,
          items,
        })
      }}
      className="space-y-4"
      data-testid="reception-form"
    >
      <select
        value={selectedFournisseur}
        onChange={e => setSelectedFournisseur(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white"
      >
        <option value="">Sélectionner un fournisseur</option>
        {fournisseurs?.map(f => (
          <option key={f.id} value={f.id}>{f.nom}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={dateReception}
          onChange={e => setDateReception(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200"
        />
        <input
          type="text"
          value={numeroBL}
          onChange={e => setNumeroBL(e.target.value)}
          placeholder="N° bon de livraison"
          className="px-4 py-3 rounded-xl border border-gray-200"
        />
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={`rounded-2xl p-4 border ${item.conforme ? 'border-gray-200 bg-white' : 'border-danger bg-red-50'}`}
            data-testid={`reception-item-${index}`}
          >
            <p className="font-medium text-gray-900">{item.nom_produit}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs text-gray-500">DLC</label>
                <input
                  type="date"
                  value={item.dlc ?? ''}
                  onChange={e => updateItem(index, { dlc: e.target.value })}
                  className={`w-full px-2 py-1 text-sm rounded-lg border ${isDLCAlerte(item.dlc) ? 'border-danger text-danger' : 'border-gray-200'}`}
                  data-testid={`item-dlc-${index}`}
                />
                {isDLCAlerte(item.dlc) && (
                  <p className="text-danger text-xs mt-1" data-testid={`dlc-alerte-${index}`}>⚠ DLC dépassée !</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">N° lot</label>
                <input
                  type="text"
                  value={item.numero_lot ?? ''}
                  onChange={e => updateItem(index, { numero_lot: e.target.value })}
                  placeholder="ex: LOT123"
                  className="w-full px-2 py-1 text-sm rounded-lg border border-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs text-gray-500">T° réception (°C)</label>
              <input
                type="number"
                value={item.temperature_reception ?? ''}
                onChange={e => updateItem(index, { temperature_reception: parseFloat(e.target.value) })}
                step={0.5}
                className="w-24 px-2 py-1 text-sm rounded-lg border border-gray-200 text-center"
              />
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.conforme}
                  onChange={e => updateItem(index, { conforme: e.target.checked })}
                  className="w-5 h-5"
                  data-testid={`item-conforme-${index}`}
                />
                <span className="text-sm">Conforme</span>
              </label>
            </div>

            {!item.conforme && (
              <textarea
                value={item.anomalie_description ?? ''}
                onChange={e => updateItem(index, { anomalie_description: e.target.value })}
                placeholder="Décrire l'anomalie constatée (obligatoire) *"
                required
                className="w-full mt-2 px-3 py-2 text-sm rounded-xl border border-danger"
                rows={2}
                data-testid={`item-anomalie-${index}`}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={!selectedFournisseur || items.length === 0 || createReception.isPending}
        className="w-full py-4 bg-primary text-white font-semibold rounded-2xl disabled:opacity-50"
        data-testid="save-reception-button"
      >
        {createReception.isPending ? 'Enregistrement...' : 'Enregistrer la réception'}
      </button>
    </form>
  )
}
```

### Step 3: Page réceptions

```typescript
// app/(app)/pms/receptions/page.tsx
// Liste des réceptions + bouton nouvelle réception
// Filtres: par fournisseur + statut (conforme/anomalie/refuse)
```

### Step 4: Tests

```typescript
// tests/unit/pms-receptions.test.ts
import { describe, it, expect } from 'vitest'

describe('validation DLC', () => {
  it('alerte si DLC passée', () => {
    const dlcPassee = '2020-01-01'
    const alerte = new Date(dlcPassee) <= new Date()
    expect(alerte).toBe(true)
  })

  it('pas d\'alerte si DLC future', () => {
    const dlcFuture = '2030-01-01'
    const alerte = new Date(dlcFuture) <= new Date()
    expect(alerte).toBe(false)
  })
})

describe('statut réception', () => {
  it('statut = anomalie si au moins un item non-conforme', () => {
    const items = [
      { conforme: true },
      { conforme: false, anomalie_description: 'Produit abîmé' },
    ]
    const hasAnomalie = items.some(i => !i.conforme)
    const statut = hasAnomalie ? 'anomalie' : 'conforme'
    expect(statut).toBe('anomalie')
  })
})
```

## Files to Create

- `app/(app)/pms/receptions/page.tsx`
- `components/pms/ReceptionForm.tsx`
- `tests/unit/pms-receptions.test.ts`

## Files to Modify

- `server/routers/pms.ts` — ajouter createReception, getReceptions

## Contracts

### Provides (pour tâches suivantes)
- `trpc.pms.createReception(...)` → `{ id, statut }`
- `trpc.pms.getReceptions(...)` → liste réceptions
- Formulaire pré-remplissable depuis OCR (initialItems)
- Alerte DLC dépassée

### Consumes
- `fournisseurs` (Task 3.1)
- `restaurant_ingredients` (Task 2.3)
- OCR data (Task 3.2) — passé en initialItems

## Acceptance Criteria

- [ ] Créer réception avec 3 produits (DLC, lot, T°)
- [ ] DLC d'hier → alerte rouge visible
- [ ] Item non-conforme → champ anomalie obligatoire
- [ ] Historique des réceptions filtrable par fournisseur
- [ ] RLS: isolation réceptions entre restaurants

## Testing Protocol

### Vitest
```bash
npm run test:unit -- pms-receptions
```

### Playwright
```typescript
await page.goto('/pms/receptions/nouvelle')
// Décocher "Conforme" pour un item
await page.uncheck('[data-testid="item-conforme-0"]')
// Vérifier: champ anomalie visible
await expect(page.locator('[data-testid="item-anomalie-0"]')).toBeVisible()
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.3:`

## PROGRESS.md Update

Marquer Task 5.3 ✅ dans PROGRESS.md.
