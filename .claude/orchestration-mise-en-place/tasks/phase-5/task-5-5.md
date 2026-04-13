# Task 5.5: RappelConso — Cron + Alertes

## Objective
Cron Vercel quotidien à 21h — fetch API RappelConso, matching avec la mercuriale du restaurant, alerte push + email si match. Heartbeat BetterUptime.

## Context
L'API RappelConso (data.economie.gouv.fr) publie les rappels produits alimentaires en France. Si un produit rappelé correspond à un ingrédient du restaurant, le restaurateur est alerté immédiatement (push notification + email). Selon D29, PMS est débloqué après 3 plats — mais le cron RappelConso tourne pour tous les restaurants.

## Dependencies
- Task 3.1 — mercuriale opérationnelle (ingrédients à matcher)

## Blocked By
- Task 3.1

## Implementation Plan

### Step 1: lib/rappelconso.ts

```typescript
// lib/rappelconso.ts
import { createClient } from '@supabase/supabase-js'

const RAPPELCONSO_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records'

export interface RappelConsoRecord {
  rappelguid: string
  nom_produit_rappele: string
  nom_marque_produit: string
  categorie_produit: string
  sous_categorie_produit: string
  motif_rappel: string
  risques_pour_le_consommateur: string
  date_debut_fev: string
  date_fin_fev?: string
  lien_vers_information_complementaire?: string
}

export async function fetchRecentRappels(limit = 100): Promise<RappelConsoRecord[]> {
  const url = new URL(RAPPELCONSO_API)
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('order_by', 'date_debut_fev DESC')
  url.searchParams.set('select', 'rappelguid,nom_produit_rappele,nom_marque_produit,categorie_produit,sous_categorie_produit,motif_rappel,risques_pour_le_consommateur,date_debut_fev,date_fin_fev,lien_vers_information_complementaire')
  // Seulement les 7 derniers jours
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  url.searchParams.set('where', `date_debut_fev >= "${sevenDaysAgo.toISOString().split('T')[0]}"`)

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'MiseEnPlace/1.0 contact@miseenplace.fr' },
    signal: AbortSignal.timeout(30000), // 30s timeout
  })

  if (!response.ok) {
    throw new Error(`RappelConso API error: ${response.status}`)
  }

  const data = await response.json()
  return data.results ?? []
}

export function matchRappelWithIngredients(
  rappel: RappelConsoRecord,
  ingredients: { id: string; nom: string }[]
): { ingredient_id: string; nom: string } | null {
  const searchText = `${rappel.nom_produit_rappele} ${rappel.nom_marque_produit}`.toLowerCase()

  for (const ingredient of ingredients) {
    const ingredientNom = ingredient.nom.toLowerCase()
    if (
      searchText.includes(ingredientNom) ||
      ingredientNom.includes(searchText.split(' ')[0])
    ) {
      return { ingredient_id: ingredient.id, nom: ingredient.nom }
    }
  }

  return null
}
```

### Step 2: app/api/cron/rappelconso/route.ts

```typescript
// app/api/cron/rappelconso/route.ts
import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@/lib/supabase/server'
import { fetchRecentRappels, matchRappelWithIngredients } from '@/lib/rappelconso'

export const maxDuration = 60 // 60s max pour le cron

export async function GET(req: NextRequest) {
  // Vérification secret cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let totalProcessed = 0
  let totalAlerts = 0

  try {
    // 1. Fetch rappels récents depuis l'API
    const rappels = await fetchRecentRappels(100)
    console.log(`[rappelconso] ${rappels.length} rappels récupérés`)

    // 2. Récupérer tous les restaurants avec leur mercuriale
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id')
      .eq('actif', true)

    for (const restaurant of (restaurants ?? [])) {
      // Récupérer les ingrédients du restaurant
      const { data: ingredients } = await supabase
        .from('restaurant_ingredients')
        .select('id, nom')
        .eq('restaurant_id', restaurant.id)

      if (!ingredients || ingredients.length === 0) continue

      // Matcher chaque rappel avec les ingrédients
      for (const rappel of rappels) {
        const match = matchRappelWithIngredients(rappel, ingredients)
        if (!match) continue

        // UPSERT pour éviter les doublons
        const { data: existingAlert } = await supabase
          .from('rappel_alerts')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('rappelconso_id', rappel.rappelguid)
          .single()

        if (existingAlert) continue // Déjà traitée

        const { data: alert } = await supabase
          .from('rappel_alerts')
          .insert({
            restaurant_id: restaurant.id,
            rappelconso_id: rappel.rappelguid,
            ingredient_id: match.ingredient_id,
            nom_produit: rappel.nom_produit_rappele,
            nom_marque: rappel.nom_marque_produit,
            motif: rappel.motif_rappel,
            risques: rappel.risques_pour_le_consommateur,
            date_rappel: rappel.date_debut_fev,
            lien_info: rappel.lien_vers_information_complementaire,
            traite: false,
          })
          .select('id')
          .single()

        if (alert) {
          totalAlerts++
          // Envoyer notification push + email
          await sendRappelNotification(restaurant.id, rappel, match.nom)
        }
      }

      totalProcessed++
    }

    // 3. Heartbeat BetterUptime
    if (process.env.BETTERUPTIME_HEARTBEAT_URL) {
      await fetch(process.env.BETTERUPTIME_HEARTBEAT_URL, { method: 'GET' }).catch(() => {})
    }

    console.log(`[rappelconso] ${totalProcessed} restaurants traités, ${totalAlerts} alertes créées`)
    return Response.json({ processed: totalProcessed, alerts: totalAlerts })
  } catch (error) {
    console.error('[rappelconso] Erreur:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

async function sendRappelNotification(
  restaurantId: string,
  rappel: any,
  ingredientNom: string
): Promise<void> {
  const supabase = createServiceClient()

  // Récupérer les subscriptions push du restaurant
  const { data: pushSubs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('restaurant_id', restaurantId)

  if (pushSubs && pushSubs.length > 0) {
    // Envoyer push (web-push) — sera implémenté en Task 6.3
    // Pour l'instant, log seulement
    console.log(`[rappelconso] Push à envoyer pour ${restaurantId}: ${ingredientNom}`)
  } else {
    // Fallback email Resend
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('nom, email_contact')
      .eq('id', restaurantId)
      .single()

    if (restaurant?.email_contact) {
      // Email via Resend (simplifié pour l'instant)
      console.log(`[rappelconso] Email à envoyer à ${restaurant.email_contact}`)
    }
  }
}
```

### Step 3: vercel.json — cron schedule

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/rappelconso",
      "schedule": "0 21 * * *"
    },
    {
      "path": "/api/cron/temperature-reminders",
      "schedule": "0 7,17 * * *"
    },
    {
      "path": "/api/cron/onboarding-notifications",
      "schedule": "0 10 * * *"
    }
  ]
}
```

### Step 4: Router tRPC — alertes

```typescript
// server/routers/pms.ts — ajouter

getRappelAlerts: protectedProcedure.query(async ({ ctx }) => {
  const { data } = await ctx.supabase
    .from('rappel_alerts')
    .select('*')
    .eq('restaurant_id', ctx.restaurantId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}),

markRappelTraite: protectedProcedure
  .input(z.object({ alertId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.supabase
      .from('rappel_alerts')
      .update({ traite: true, traite_le: new Date().toISOString() })
      .eq('id', input.alertId)
      .eq('restaurant_id', ctx.restaurantId)
    return { success: true }
  }),
```

### Step 5: Page alertes RappelConso

```typescript
// app/(app)/pms/rappels/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'

export default function RappelsPage() {
  const { data: alerts, refetch } = trpc.pms.getRappelAlerts.useQuery()
  const markTraite = trpc.pms.markRappelTraite.useMutation({ onSuccess: refetch })

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-6">Alertes RappelConso</h1>
      <div className="space-y-3">
        {alerts?.map(alert => (
          <div key={alert.id} className={`rounded-2xl p-4 border ${alert.traite ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-red-50 border-danger'}`} data-testid={`rappel-alert-${alert.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-bold text-danger">{alert.nom_produit}</p>
                <p className="text-sm text-gray-600 mt-1">{alert.motif}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Ingrédient concerné: <strong>{alert.ingredient?.nom}</strong>
                </p>
              </div>
              {!alert.traite && (
                <button
                  onClick={() => markTraite.mutate({ alertId: alert.id })}
                  className="ml-2 px-3 py-1 text-xs bg-primary text-white rounded-full"
                >
                  Traité
                </button>
              )}
            </div>
          </div>
        ))}
        {alerts?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">✅</p>
            <p>Aucune alerte de rappel produit</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Step 6: Tests

```typescript
// tests/unit/rappelconso.test.ts
import { describe, it, expect } from 'vitest'
import { matchRappelWithIngredients } from '@/lib/rappelconso'

const mockRappel = {
  rappelguid: 'test-guid',
  nom_produit_rappele: 'Fromage brie de Meaux',
  nom_marque_produit: 'Ferme Dupont',
  categorie_produit: 'Fromages',
  sous_categorie_produit: 'Fromages à pâte molle',
  motif_rappel: 'Présence de Listeria',
  risques_pour_le_consommateur: 'Listériose',
  date_debut_fev: '2026-04-01',
}

describe('matchRappelWithIngredients', () => {
  it('trouve un match si le nom de l\'ingrédient est dans le produit rappelé', () => {
    const ingredients = [
      { id: '1', nom: 'brie' },
      { id: '2', nom: 'camembert' },
    ]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).not.toBeNull()
    expect(match?.ingredient_id).toBe('1')
  })

  it('retourne null si pas de match', () => {
    const ingredients = [
      { id: '1', nom: 'beurre' },
      { id: '2', nom: 'crème' },
    ]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).toBeNull()
  })

  it('matching insensible à la casse', () => {
    const ingredients = [{ id: '1', nom: 'BRIE' }]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).not.toBeNull()
  })
})
```

## Files to Create

- `lib/rappelconso.ts`
- `app/api/cron/rappelconso/route.ts`
- `app/(app)/pms/rappels/page.tsx`
- `vercel.json`
- `tests/unit/rappelconso.test.ts`

## Files to Modify

- `server/routers/pms.ts` — ajouter getRappelAlerts, markRappelTraite

## Contracts

### Provides (pour tâches suivantes)
- `GET /api/cron/rappelconso` → cron protégé par CRON_SECRET
- `trpc.pms.getRappelAlerts()` → liste alertes
- `matchRappelWithIngredients()` — fonction de matching réutilisable
- `vercel.json` avec tous les crons configurés (pour Task 7.3)
- Heartbeat BetterUptime après chaque exécution

### Consumes (de Task 3.1)
- `restaurant_ingredients` table
- `rappel_alerts` table (Task 1.2)

## Acceptance Criteria

- [ ] `curl /api/cron/rappelconso` sans secret → 401
- [ ] `curl /api/cron/rappelconso` avec CRON_SECRET → 200 + `{ processed: N }`
- [ ] Rappel avec nom correspondant à un ingrédient → rappel_alerts créé
- [ ] UPSERT correct (pas de doublon si cron relancé)
- [ ] Heartbeat BetterUptime ping reçu
- [ ] UI alertes: liste visible + bouton "Traité"
- [ ] `matchRappelWithIngredients` tests passent (Vitest)

## Testing Protocol

### Vitest
```bash
npm run test:unit -- rappelconso
```

### curl
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/rappelconso
# Attendu: {"processed":N,"alerts":M}
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.5:`

## PROGRESS.md Update

Marquer Task 5.5 ✅ dans PROGRESS.md.
