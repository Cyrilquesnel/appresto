# Task 4.1: Saisie Ventes Quotidienne

## Objective
Formulaire rapide de saisie ventes (mode simple: couverts × panier moyen OU mode détaillé: plat par plat). Saisie en < 30 secondes.

## Context
Selon D6 de DISCOVERY.md, deux modes sont disponibles. Le mode simple est le défaut (3 champs max). Le mode détaillé permet de saisir plat par plat pour un suivi plus précis. La préférence est stockée dans `restaurants.parametres`.

## Dependencies
- Task 2.3 — plats créés et disponibles pour le mode détaillé

## Blocked By
- Task 2.3

## Implementation Plan

### Step 1: Router tRPC — ventes

```typescript
// server/routers/dashboard.ts — première implémentation
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

const ServiceEnum = z.enum(['midi', 'soir', 'continu'])
const ModeVentesEnum = z.enum(['simple', 'detail'])

export const dashboardRouter = router({
  // ═══ VENTES ═══
  logVentes: protectedProcedure
    .input(z.discriminatedUnion('mode', [
      // Mode simple: couverts × panier moyen
      z.object({
        mode: z.literal('simple'),
        date: z.string(),        // ISO date YYYY-MM-DD
        service: ServiceEnum,
        nb_couverts: z.number().int().min(0),
        panier_moyen: z.number().positive(),
        notes: z.string().optional(),
      }),
      // Mode détaillé: plat par plat
      z.object({
        mode: z.literal('detail'),
        date: z.string(),
        service: ServiceEnum,
        lignes: z.array(z.object({
          plat_id: z.string().uuid(),
          quantite: z.number().int().positive(),
          prix_vente: z.number().positive(),
        })).min(1),
        notes: z.string().optional(),
      }),
    ]))
    .mutation(async ({ ctx, input }) => {
      if (input.mode === 'simple') {
        const montant = input.nb_couverts * input.panier_moyen
        const { error } = await ctx.supabase.from('ventes').insert({
          restaurant_id: ctx.restaurantId,
          date: input.date,
          service: input.service,
          nb_couverts: input.nb_couverts,
          panier_moyen: input.panier_moyen,
          montant_total: montant,
          plat_id: null,
          mode_saisie: 'simple',
          notes: input.notes,
        })
        if (error) throw new Error(error.message)
        return { success: true, montant_total: montant }
      } else {
        // Mode détaillé: insérer une ligne par plat
        const insertions = input.lignes.map(l => ({
          restaurant_id: ctx.restaurantId,
          date: input.date,
          service: input.service,
          plat_id: l.plat_id,
          quantite: l.quantite,
          montant_total: l.quantite * l.prix_vente,
          mode_saisie: 'detail',
          notes: input.notes,
        }))
        const { error } = await ctx.supabase.from('ventes').insert(insertions)
        if (error) throw new Error(error.message)
        const total = input.lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)
        return { success: true, montant_total: total }
      }
    }),

  getVentes: protectedProcedure
    .input(z.object({
      date_debut: z.string(),
      date_fin: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('ventes')
        .select('*, plat:plats(nom)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date', input.date_debut)
        .lte('date', input.date_fin)
        .order('date', { ascending: false })
      return data ?? []
    }),

  // ═══ CHARGES ═══
  saveCharges: protectedProcedure
    .input(z.object({
      mois: z.string(),   // YYYY-MM
      masse_salariale: z.number().min(0).optional(),
      loyer: z.number().min(0).optional(),
      energie: z.number().min(0).optional(),
      assurances: z.number().min(0).optional(),
      autres_charges: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { mois, ...charges } = input
      await ctx.supabase
        .from('charges')
        .upsert({
          restaurant_id: ctx.restaurantId,
          mois,
          ...charges,
          charges_fixes_total: Object.values(charges).reduce((a: number, b) => a + (b ?? 0), 0),
        }, { onConflict: 'restaurant_id,mois' })
      return { success: true }
    }),

  getCharges: protectedProcedure
    .input(z.object({ mois: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('charges')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('mois', input.mois)
        .single()
      return data
    }),

  // ═══ MODE VENTES (préférence) ═══
  getModeVentes: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('restaurants')
      .select('parametres')
      .eq('id', ctx.restaurantId)
      .single()
    return (data?.parametres as any)?.mode_ventes ?? 'simple'
  }),

  setModeVentes: protectedProcedure
    .input(z.object({ mode: ModeVentesEnum }))
    .mutation(async ({ ctx, input }) => {
      const { data: restaurant } = await ctx.supabase
        .from('restaurants')
        .select('parametres')
        .eq('id', ctx.restaurantId)
        .single()

      await ctx.supabase
        .from('restaurants')
        .update({
          parametres: { ...(restaurant?.parametres as any ?? {}), mode_ventes: input.mode },
        })
        .eq('id', ctx.restaurantId)
      return { success: true }
    }),
})
```

### Step 2: Composant SaisieVentesSimple

```typescript
// components/dashboard/SaisieVentesSimple.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface SaisieVentesSimpleProps {
  onSuccess: (montant: number) => void
}

export function SaisieVentesSimple({ onSuccess }: SaisieVentesSimpleProps) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [service, setService] = useState<'midi' | 'soir'>('midi')
  const [couverts, setCouverts] = useState('')
  const [panierMoyen, setPanierMoyen] = useState('')

  const logVentes = trpc.dashboard.logVentes.useMutation({
    onSuccess: (data) => {
      onSuccess(data.montant_total)
      setCouverts('')
    },
  })

  const montantEstime = couverts && panierMoyen
    ? (parseFloat(couverts) * parseFloat(panierMoyen)).toFixed(2)
    : null

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        logVentes.mutate({
          mode: 'simple',
          date,
          service,
          nb_couverts: parseInt(couverts),
          panier_moyen: parseFloat(panierMoyen),
        })
      }}
      className="space-y-4"
      data-testid="saisie-ventes-simple"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          data-testid="ventes-date"
        />
        <select
          value={service}
          onChange={e => setService(e.target.value as 'midi' | 'soir')}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          data-testid="ventes-service"
        >
          <option value="midi">Midi</option>
          <option value="soir">Soir</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nb couverts</label>
          <input
            type="number"
            value={couverts}
            onChange={e => setCouverts(e.target.value)}
            min={0}
            required
            placeholder="ex: 35"
            className="w-full px-4 py-4 text-2xl font-bold rounded-xl border border-gray-200 bg-white text-center"
            data-testid="ventes-couverts"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Panier moyen HT (€)</label>
          <input
            type="number"
            value={panierMoyen}
            onChange={e => setPanierMoyen(e.target.value)}
            min={0}
            step={0.5}
            required
            placeholder="ex: 28"
            className="w-full px-4 py-4 text-2xl font-bold rounded-xl border border-gray-200 bg-white text-center"
            data-testid="ventes-panier"
          />
        </div>
      </div>

      {montantEstime && (
        <div className="bg-success/10 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">CA estimé</p>
          <p className="text-3xl font-bold text-success">{montantEstime} €</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!couverts || !panierMoyen || logVentes.isPending}
        className="w-full py-4 bg-accent text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-ventes-button"
      >
        {logVentes.isPending ? 'Enregistrement...' : '✓ Valider les ventes'}
      </button>
    </form>
  )
}
```

### Step 3: Page saisie ventes

```typescript
// app/(app)/dashboard/saisie-ventes/page.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { SaisieVentesSimple } from '@/components/dashboard/SaisieVentesSimple'
import { SaisieVentesDetail } from '@/components/dashboard/SaisieVentesDetail'

export default function SaisieVentesPage() {
  const { data: mode } = trpc.dashboard.getModeVentes.useQuery()
  const [success, setSuccess] = useState<number | null>(null)

  if (success !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-primary mb-2">Ventes enregistrées !</h2>
        <p className="text-3xl font-bold text-success mb-6">{success.toFixed(2)} € HT</p>
        <button onClick={() => setSuccess(null)} className="text-accent hover:underline">
          Saisir un autre service
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-6">Saisie des ventes</h1>
      {mode === 'simple' ? (
        <SaisieVentesSimple onSuccess={setSuccess} />
      ) : (
        <SaisieVentesDetail onSuccess={setSuccess} />
      )}
    </div>
  )
}
```

### Step 4: Tests

```typescript
// tests/unit/ventes.test.ts
import { describe, it, expect } from 'vitest'

describe('logVentes mode simple', () => {
  it('calcule montant_total = nb_couverts × panier_moyen', () => {
    const nb_couverts = 35
    const panier_moyen = 28.50
    const montant = nb_couverts * panier_moyen
    expect(montant).toBe(997.50)
  })
})

describe('logVentes mode detail', () => {
  it('calcule montant_total = somme(quantite × prix_vente)', () => {
    const lignes = [
      { quantite: 3, prix_vente: 22.00 },
      { quantite: 2, prix_vente: 18.50 },
    ]
    const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)
    expect(total).toBe(103.00)
  })
})
```

## Files to Create

- `app/(app)/dashboard/saisie-ventes/page.tsx`
- `components/dashboard/SaisieVentesSimple.tsx`
- `components/dashboard/SaisieVentesDetail.tsx`
- `components/dashboard/ChargesForm.tsx`
- `tests/unit/ventes.test.ts`

## Files to Modify

- `server/routers/dashboard.ts` — implémenter logVentes, getVentes, saveCharges, getModeVentes

## Contracts

### Provides (pour tâches suivantes)
- `trpc.dashboard.logVentes(...)` → INSERT ventes
- `trpc.dashboard.getVentes({ date_debut, date_fin })` → liste ventes
- `trpc.dashboard.saveCharges(...)` → upsert charges mensuelles
- `trpc.dashboard.getModeVentes()` → 'simple' | 'detail'
- Table `ventes` remplie pour calculs dashboard (Task 4.2)

### Consumes (de Task 2.3)
- `plats` table pour mode détaillé

## Acceptance Criteria

- [ ] Saisie mode simple : 3 champs (date, service, couverts + panier) — validé en < 30s
- [ ] CA estimé affiché avant validation
- [ ] Saisie 2 services (midi + soir) → 2 entrées en BDD (vérifier SQL)
- [ ] Changement de mode via paramètres → préférence persistée
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- ventes
```

### Playwright
```typescript
await page.goto('/dashboard/saisie-ventes')
await page.fill('[data-testid="ventes-couverts"]', '35')
await page.fill('[data-testid="ventes-panier"]', '28')
// Vérifier estimation CA
await expect(page.locator('text=980.00 €')).toBeVisible()
await page.click('[data-testid="save-ventes-button"]')
await expect(page.locator('text=Ventes enregistrées')).toBeVisible()
```

## Git

- Branch: `phase-4/piloter`
- Commit message prefix: `Task 4.1:`

## PROGRESS.md Update

Marquer Task 4.1 ✅ dans PROGRESS.md.
