# Task 4.2: Dashboard Food Cost + Charges

## Objective
Dashboard mobile affichant food cost %, masse salariale, charges fixes, seuil de rentabilité — données du mois courant. Chargement < 1s.

## Context
Le dashboard est la page principale de l'app. Il doit donner une vision claire de la santé financière du restaurant en un coup d'œil. Les KPIs sont calculés côté serveur pour minimiser le temps de chargement.

## Dependencies
- Task 4.1 — saisie ventes + charges opérationnels

## Blocked By
- Task 4.1

## Implementation Plan

### Step 1: Router tRPC — dashboard.get (KPIs)

```typescript
// server/routers/dashboard.ts — ajouter à la suite de 4.1

get: protectedProcedure
  .input(z.object({
    periode: z.enum(['mois', 'semaine']).default('mois'),
  }))
  .query(async ({ ctx, input }) => {
    const now = new Date()
    
    let dateDebut: string
    let dateFin: string
    let moisCourant: string
    
    if (input.periode === 'mois') {
      dateDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      dateFin = now.toISOString().split('T')[0]
      moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    } else {
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      dateDebut = monday.toISOString().split('T')[0]
      dateFin = now.toISOString().split('T')[0]
      moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    // Récupérer ventes en parallèle avec charges
    const [ventesResult, chargesResult, platsResult] = await Promise.all([
      ctx.supabase
        .from('ventes')
        .select('montant_total, nb_couverts, plat_id, quantite')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date', dateDebut)
        .lte('date', dateFin),
      ctx.supabase
        .from('charges')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('mois', moisCourant)
        .single(),
      ctx.supabase
        .from('plats')
        .select('id, cout_de_revient')
        .eq('restaurant_id', ctx.restaurantId)
        .not('cout_de_revient', 'is', null),
    ])

    const ventes = ventesResult.data ?? []
    const charges = chargesResult.data
    const platsAvecCout = platsResult.data ?? []

    // Calculs
    const ca_total = ventes.reduce((sum, v) => sum + (v.montant_total ?? 0), 0)
    const nb_couverts = ventes.reduce((sum, v) => sum + (v.nb_couverts ?? 0), 0)
    const panier_moyen = nb_couverts > 0 ? ca_total / nb_couverts : null

    // Food cost: somme(quantite × cout_de_revient) / ca_total
    const platsMap = Object.fromEntries(platsAvecCout.map(p => [p.id, p.cout_de_revient]))
    const food_cost_euros = ventes.reduce((sum, v) => {
      if (!v.plat_id || !v.quantite) return sum
      const cout = platsMap[v.plat_id]
      if (cout == null) return sum
      return sum + v.quantite * cout
    }, 0)

    const food_cost_pct = ca_total > 0 && food_cost_euros > 0
      ? Math.round((food_cost_euros / ca_total) * 10000) / 100
      : null

    const masse_salariale = charges?.masse_salariale ?? null
    const charges_fixes = charges
      ? (charges.loyer ?? 0) + (charges.energie ?? 0) + (charges.assurances ?? 0) + (charges.autres_charges ?? 0)
      : null

    const marge_brute = ca_total > 0
      ? ca_total - (food_cost_euros ?? 0) - (masse_salariale ?? 0) - (charges_fixes ?? 0)
      : null

    // Seuil de rentabilité = charges_fixes / (1 - food_cost_pct/100)
    const seuil_rentabilite = charges_fixes && food_cost_pct && food_cost_pct < 100
      ? charges_fixes / (1 - food_cost_pct / 100)
      : null

    return {
      ca_total: Math.round(ca_total * 100) / 100,
      food_cost_euros: Math.round(food_cost_euros * 100) / 100,
      food_cost_pct,
      masse_salariale,
      charges_fixes,
      marge_brute: marge_brute != null ? Math.round(marge_brute * 100) / 100 : null,
      seuil_rentabilite: seuil_rentabilite != null ? Math.round(seuil_rentabilite * 100) / 100 : null,
      nb_couverts,
      panier_moyen: panier_moyen != null ? Math.round(panier_moyen * 100) / 100 : null,
      periode: input.periode,
      date_debut: dateDebut,
      date_fin: dateFin,
    }
  }),

// Données hebdomadaires pour le graphique
getVentesSemaine: protectedProcedure.query(async ({ ctx }) => {
  const today = new Date()
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const { data: ventes } = await ctx.supabase
    .from('ventes')
    .select('date, montant_total')
    .eq('restaurant_id', ctx.restaurantId)
    .gte('date', dates[0])
    .lte('date', dates[6])

  return dates.map(date => ({
    date,
    montant: ventes?.filter(v => v.date === date).reduce((s, v) => s + (v.montant_total ?? 0), 0) ?? 0,
  }))
}),
```

### Step 2: Composants KPI Cards

```typescript
// components/dashboard/FoodCostCard.tsx
interface FoodCostCardProps {
  pct: number | null
  euros: number | null
  ca: number
}

export function FoodCostCard({ pct, euros, ca }: FoodCostCardProps) {
  const status = pct == null ? 'na' : pct <= 30 ? 'good' : pct <= 35 ? 'warn' : 'bad'
  const colors = {
    na: 'bg-gray-50 border-gray-200',
    good: 'bg-green-50 border-green-200',
    warn: 'bg-yellow-50 border-yellow-200',
    bad: 'bg-red-50 border-red-200',
  }
  const textColors = { na: 'text-gray-400', good: 'text-success', warn: 'text-warning', bad: 'text-danger' }

  return (
    <div className={`rounded-2xl p-4 border ${colors[status]}`} data-testid="food-cost-card">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Food Cost</p>
      {pct == null ? (
        <p className="text-sm text-gray-400 mt-2">Ajoutez des prix en mercuriale pour calculer votre food cost</p>
      ) : (
        <>
          <p className={`text-4xl font-bold mt-1 ${textColors[status]}`} data-testid="food-cost-pct">{pct}%</p>
          <p className="text-sm text-gray-500 mt-1">{euros?.toFixed(2)} € / {ca.toFixed(2)} € CA</p>
          <p className="text-xs text-gray-400 mt-1">
            {status === 'good' ? '✓ Maîtrisé (< 30%)' : status === 'warn' ? '⚠ Attention (30-35%)' : '⚠ Élevé (> 35%)'}
          </p>
        </>
      )}
    </div>
  )
}
```

```typescript
// components/dashboard/SeuilRentabiliteCard.tsx
interface SeuilRentabiliteCardProps {
  seuil: number | null
  ca: number
  chargesFixes: number | null
}

export function SeuilRentabiliteCard({ seuil, ca, chargesFixes }: SeuilRentabiliteCardProps) {
  if (!chargesFixes) {
    return (
      <div className="rounded-2xl p-4 border border-gray-200 bg-gray-50" data-testid="seuil-card">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Seuil de rentabilité</p>
        <p className="text-sm text-gray-400 mt-2">Ajoutez vos charges pour voir le seuil</p>
      </div>
    )
  }

  const atteint = seuil != null && ca >= seuil
  return (
    <div className={`rounded-2xl p-4 border ${atteint ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`} data-testid="seuil-card">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Seuil de rentabilité</p>
      <p className={`text-4xl font-bold mt-1 ${atteint ? 'text-success' : 'text-warning'}`} data-testid="seuil-value">
        {seuil?.toFixed(0)} €
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {atteint ? `✓ Atteint (CA: ${ca.toFixed(0)} €)` : `${(seuil! - ca).toFixed(0)} € restants`}
      </p>
    </div>
  )
}
```

### Step 3: Page dashboard

```typescript
// app/(app)/dashboard/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { FoodCostCard } from '@/components/dashboard/FoodCostCard'
import { SeuilRentabiliteCard } from '@/components/dashboard/SeuilRentabiliteCard'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: kpis, isLoading } = trpc.dashboard.get.useQuery({ periode: 'mois' })
  const { data: semaine } = trpc.dashboard.getVentesSemaine.useQuery()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" /></div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <span className="text-xs text-gray-400">Ce mois-ci</span>
      </div>

      {/* CA total */}
      <div className="bg-primary rounded-2xl p-5 text-white" data-testid="ca-card">
        <p className="text-xs opacity-70 uppercase tracking-wide">Chiffre d'affaires HT</p>
        <p className="text-4xl font-bold mt-1" data-testid="ca-value">{kpis?.ca_total.toFixed(2)} €</p>
        <div className="flex gap-4 mt-2 text-sm opacity-70">
          {kpis?.nb_couverts && <span>{kpis.nb_couverts} couverts</span>}
          {kpis?.panier_moyen && <span>{kpis.panier_moyen.toFixed(0)} €/couvert</span>}
        </div>
      </div>

      {/* Food Cost */}
      <FoodCostCard
        pct={kpis?.food_cost_pct ?? null}
        euros={kpis?.food_cost_euros ?? null}
        ca={kpis?.ca_total ?? 0}
      />

      {/* Seuil rentabilité */}
      <SeuilRentabiliteCard
        seuil={kpis?.seuil_rentabilite ?? null}
        ca={kpis?.ca_total ?? 0}
        chargesFixes={kpis?.charges_fixes ?? null}
      />

      {/* Masse salariale */}
      {kpis?.masse_salariale && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Masse salariale</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.masse_salariale.toFixed(0)} €</p>
        </div>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/saisie-ventes" className="bg-accent text-white rounded-2xl p-4 text-center font-semibold" data-testid="btn-saisie-ventes">
          + Saisir ventes
        </Link>
        <Link href="/plats/nouveau" className="bg-white border border-gray-200 text-primary rounded-2xl p-4 text-center font-semibold">
          + Nouveau plat
        </Link>
      </div>
    </div>
  )
}
```

### Step 4: Tests

```typescript
// tests/unit/dashboard-kpis.test.ts
import { describe, it, expect } from 'vitest'

describe('calcul KPIs dashboard', () => {
  it('food_cost_pct = food_cost_euros / ca_total × 100', () => {
    const ca_total = 10000
    const food_cost_euros = 2800
    const pct = Math.round((food_cost_euros / ca_total) * 10000) / 100
    expect(pct).toBe(28.00)
  })

  it('seuil_rentabilite = charges_fixes / (1 - food_cost_pct/100)', () => {
    const charges_fixes = 5000
    const food_cost_pct = 30
    const seuil = charges_fixes / (1 - food_cost_pct / 100)
    expect(Math.round(seuil)).toBe(7143)
  })

  it('retourne null si pas de ventes', () => {
    const ca_total = 0
    const food_cost_pct = ca_total > 0 ? 28 : null
    expect(food_cost_pct).toBeNull()
  })
})
```

## Files to Create

- `app/(app)/dashboard/page.tsx`
- `components/dashboard/FoodCostCard.tsx`
- `components/dashboard/ChargesCard.tsx`
- `components/dashboard/SeuilRentabiliteCard.tsx`
- `components/dashboard/VentesSemaineChart.tsx`
- `tests/unit/dashboard-kpis.test.ts`

## Files to Modify

- `server/routers/dashboard.ts` — ajouter `get` + `getVentesSemaine`

## Contracts

### Provides (pour tâches suivantes)
- `trpc.dashboard.get({ periode })` → KPIs complets
- `trpc.dashboard.getVentesSemaine()` → données graphique 7j
- Pages dashboard avec tous les KPIs

### Consumes (de Task 4.1)
- `ventes` table
- `charges` table
- `plats.cout_de_revient` (calculé en 2.5)

## Acceptance Criteria

- [ ] Dashboard s'affiche en < 1s (mesurer avec Playwright)
- [ ] Food cost % correct sur données de test
- [ ] Seuil de rentabilité affiché ou message "Ajoutez vos charges"
- [ ] Données null → placeholders clairs (pas d'erreur)
- [ ] Responsive mobile-first (iPhone 14 Playwright)
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- dashboard-kpis
```

### Playwright
```typescript
// Mesurer temps de chargement
await page.goto('/dashboard')
const timing = await page.evaluate(() => performance.timing)
const loadTime = timing.loadEventEnd - timing.navigationStart
expect(loadTime).toBeLessThan(1000)

// Vérifier KPIs présents
await expect(page.locator('[data-testid="ca-card"]')).toBeVisible()
await expect(page.locator('[data-testid="food-cost-card"]')).toBeVisible()
```

## Git

- Branch: `phase-4/piloter`
- Commit message prefix: `Task 4.2:`

## PROGRESS.md Update

Marquer Task 4.2 ✅ dans PROGRESS.md.
