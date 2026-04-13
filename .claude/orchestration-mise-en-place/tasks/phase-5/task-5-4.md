# Task 5.4: HACCP Auto-génération (Claude Haiku)

## Objective
Génération du plan HACCP à la demande ("Générer mon plan HACCP") depuis les fiches techniques existantes. Bloqué si < 3 plats créés.

## Context
Selon D7 de DISCOVERY.md, la génération HACCP est UNIQUEMENT à la demande (bouton), jamais automatique. Claude Haiku analyse les fiches techniques et identifie les points critiques (CCP). Selon D29, le bouton est accessible uniquement après 3+ plats créés.

## Dependencies
- Task 2.3 — fiches techniques créées

## Blocked By
- Task 2.3

## Implementation Plan

### Step 1: lib/ai/haccp-generator.ts

```typescript
// lib/ai/haccp-generator.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface HACCPPointCritique {
  plat_id: string | null  // null si point général
  plat_nom?: string
  danger: string           // ex: "Contamination bactérienne (Salmonella)"
  etape_critique: string   // ex: "Cuisson", "Refroidissement"
  ccp_numero: string       // ex: "CCP-1", "CCP-2"
  temperature_critique?: number  // °C
  limite_critique: string  // ex: "74°C minimum pendant 2 minutes"
  mesure_surveillance: string
  action_corrective: string
  verification: string
}

const SYSTEM_PROMPT = `Tu es un consultant HACCP certifié, expert en réglementation alimentaire française (règlement CE 852/2004, arrêtés du 21 décembre 2009).

Pour chaque plat décrit, identifie:
1. Les dangers biologiques (bactéries, virus, parasites), chimiques et physiques
2. Les Points de Contrôle Critiques (CCP) selon l'arbre de décision HACCP
3. Les limites critiques (températures, durées) selon la réglementation française
4. Les mesures de surveillance et actions correctives

Réponds avec un tableau JSON de points critiques. Pour la volaille et viande hachée: 74°C minimum. Pour le porc: 63°C. Pour les produits laitiers non pasteurisés: surveiller chaîne du froid. Pour la liaison froide: < 4°C en 2h.`

export async function generateHACCPPlan(
  plats: Array<{ id: string; nom: string; ingredients: Array<{ nom: string; allergenes: string[] }>; type_plat?: string }>
): Promise<HACCPPointCritique[]> {
  const platsSummary = plats.map(p => ({
    nom: p.nom,
    type: p.type_plat,
    ingredients: p.ingredients.map(i => i.nom).join(', '),
    allergenes: [...new Set(p.ingredients.flatMap(i => i.allergenes))],
  }))

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Génère le plan HACCP pour ce restaurant avec ces plats:

${JSON.stringify(platsSummary, null, 2)}

Retourne un tableau JSON d'objets avec ces champs:
- plat_nom: nom du plat concerné (ou "Général" si point commun à tous)
- danger: description du danger
- etape_critique: étape du process à risque
- ccp_numero: ex "CCP-1"
- temperature_critique: en degrés Celsius (null si non applicable)
- limite_critique: description précise
- mesure_surveillance: comment surveiller
- action_corrective: que faire si limite dépassée
- verification: comment vérifier le système

Génère UNIQUEMENT le JSON, sans markdown, sans explication.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  
  try {
    const points = JSON.parse(text) as Array<any>
    return points.map((p, i) => ({
      plat_id: plats.find(pl => pl.nom === p.plat_nom)?.id ?? null,
      plat_nom: p.plat_nom,
      danger: p.danger,
      etape_critique: p.etape_critique,
      ccp_numero: p.ccp_numero ?? `CCP-${i + 1}`,
      temperature_critique: p.temperature_critique,
      limite_critique: p.limite_critique,
      mesure_surveillance: p.mesure_surveillance,
      action_corrective: p.action_corrective,
      verification: p.verification,
    }))
  } catch {
    throw new Error('Erreur parsing réponse Claude HACCP')
  }
}
```

### Step 2: Router tRPC — HACCP

```typescript
// server/routers/pms.ts — ajouter dans pmsRouter

// ═══ HACCP ═══
generateHACCP: protectedProcedure.mutation(async ({ ctx }) => {
  // Vérifier que le restaurant a au moins 3 plats (D29)
  const { count } = await ctx.supabase
    .from('plats')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', ctx.restaurantId)
    .eq('statut', 'actif')

  if ((count ?? 0) < 3) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Créez au moins 3 plats actifs pour générer le plan HACCP',
    })
  }

  // Récupérer les fiches techniques
  const { data: plats } = await ctx.supabase
    .from('plats')
    .select(`
      id, nom, type_plat,
      fiche_technique(
        nom_ingredient, ingredient:restaurant_ingredients(allergenes)
      )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('statut', 'actif')
    .limit(20)

  if (!plats || plats.length === 0) {
    throw new Error('Aucun plat actif trouvé')
  }

  const platsFormatted = plats.map(p => ({
    id: p.id,
    nom: p.nom,
    type_plat: p.type_plat,
    ingredients: (p.fiche_technique as any[]).map(ft => ({
      nom: ft.nom_ingredient,
      allergenes: (ft.ingredient as any)?.allergenes ?? [],
    })),
  }))

  // Générer avec Claude Haiku
  const points = await generateHACCPPlan(platsFormatted)

  // Supprimer les anciens points (régénération complète)
  await ctx.supabase
    .from('haccp_points_critiques')
    .delete()
    .eq('restaurant_id', ctx.restaurantId)

  // Insérer les nouveaux points
  if (points.length > 0) {
    await ctx.supabase.from('haccp_points_critiques').insert(
      points.map(p => ({
        restaurant_id: ctx.restaurantId,
        plat_id: p.plat_id,
        plat_nom: p.plat_nom,
        danger: p.danger,
        etape_critique: p.etape_critique,
        ccp_numero: p.ccp_numero,
        temperature_critique: p.temperature_critique,
        limite_critique: p.limite_critique,
        mesure_surveillance: p.mesure_surveillance,
        action_corrective: p.action_corrective,
        verification: p.verification,
        genere_le: new Date().toISOString(),
      }))
    )
  }

  return { points_count: points.length, points }
}),

getHACCPPlan: protectedProcedure.query(async ({ ctx }) => {
  const { data: platsCount } = await ctx.supabase
    .from('plats')
    .select('id', { count: 'exact' })
    .eq('restaurant_id', ctx.restaurantId)
    .eq('statut', 'actif')

  const { data: points } = await ctx.supabase
    .from('haccp_points_critiques')
    .select('*')
    .eq('restaurant_id', ctx.restaurantId)
    .order('ccp_numero')

  return {
    can_generate: (platsCount?.length ?? 0) >= 3,
    plats_count: platsCount?.length ?? 0,
    points: points ?? [],
    last_generated: points?.[0]?.genere_le ?? null,
  }
}),
```

### Step 3: Composant HACCPDisplay

```typescript
// components/pms/HACCPDisplay.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

export function HACCPDisplay() {
  const { data, refetch } = trpc.pms.getHACCPPlan.useQuery()
  const generate = trpc.pms.generateHACCP.useMutation({
    onSuccess: () => refetch(),
  })

  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4" data-testid="haccp-display">
      {/* Header + bouton générer */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Plan HACCP</h2>
          {data?.last_generated && (
            <p className="text-xs text-gray-400">
              Généré le {new Date(data.last_generated).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={!data?.can_generate || generate.isPending}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={!data?.can_generate ? `Créez ${3 - (data?.plats_count ?? 0)} plat(s) de plus` : ''}
          data-testid="generate-haccp-button"
        >
          {generate.isPending ? '⏳ Génération...' : data?.points.length ? '🔄 Régénérer' : '✨ Générer'}
        </button>
      </div>

      {/* Message si pas assez de plats */}
      {!data?.can_generate && (
        <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200" data-testid="haccp-blocked">
          <p className="text-sm text-warning font-medium">
            ⚠ Créez au moins 3 plats actifs pour générer le plan HACCP
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ({data?.plats_count ?? 0}/3 plats actifs)
          </p>
        </div>
      )}

      {/* Liste des CCP */}
      {data?.points.map(point => (
        <div
          key={point.id}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          data-testid={`ccp-${point.ccp_numero}`}
        >
          <button
            onClick={() => setExpanded(expanded === point.id ? null : point.id)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <span className="text-xs font-mono bg-primary text-white px-2 py-0.5 rounded-full mr-2">
                {point.ccp_numero}
              </span>
              <span className="font-semibold text-gray-900">{point.etape_critique}</span>
            </div>
            <span className="text-gray-400">{expanded === point.id ? '▲' : '▼'}</span>
          </button>

          {expanded === point.id && (
            <div className="px-4 pb-4 space-y-3 text-sm">
              {point.plat_nom && (
                <p className="text-accent font-medium">Plat: {point.plat_nom}</p>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Danger</p>
                <p className="text-gray-700">{point.danger}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Limite critique</p>
                <p className="text-gray-700 font-medium">
                  {point.temperature_critique && `${point.temperature_critique}°C — `}
                  {point.limite_critique}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Action corrective</p>
                <p className="text-gray-700">{point.action_corrective}</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {generate.isError && (
        <p className="text-danger text-sm text-center">
          Erreur: {generate.error.message}
        </p>
      )}
    </div>
  )
}
```

### Step 4: Tests

```typescript
// tests/unit/haccp-generator.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify([{
            plat_nom: 'Poulet rôti',
            danger: 'Contamination Salmonella',
            etape_critique: 'Cuisson',
            ccp_numero: 'CCP-1',
            temperature_critique: 74,
            limite_critique: '74°C minimum pendant 2 minutes',
            mesure_surveillance: 'Sonde de température cœur',
            action_corrective: 'Poursuivre la cuisson',
            verification: 'Calibration mensuelle sonde',
          }]),
        }],
      }),
    },
  })),
}))

describe('generateHACCPPlan', () => {
  it('génère des points HACCP pour un plat avec volaille', async () => {
    const { generateHACCPPlan } = await import('@/lib/ai/haccp-generator')
    const plats = [{
      id: 'test-id',
      nom: 'Poulet rôti',
      ingredients: [{ nom: 'poulet', allergenes: [] }],
      type_plat: 'Viande',
    }]
    const points = await generateHACCPPlan(plats)
    expect(points).toHaveLength(1)
    expect(points[0].temperature_critique).toBe(74)
  })
})
```

## Files to Create

- `lib/ai/haccp-generator.ts`
- `app/(app)/pms/haccp/page.tsx`
- `components/pms/HACCPDisplay.tsx`
- `tests/unit/haccp-generator.test.ts`

## Files to Modify

- `server/routers/pms.ts` — ajouter generateHACCP, getHACCPPlan

## Acceptance Criteria

- [ ] Bouton HACCP visible après 3+ plats actifs
- [ ] Bouton HACCP grisé avec message si < 3 plats
- [ ] Génération HACCP en < 30s pour 5 plats
- [ ] Points critiques incluent températures correctes (volaille: 74°C)
- [ ] Plan sauvegardé en BDD et consultable
- [ ] Régénérer → remplace les anciens points

## Testing Protocol

### Vitest
```bash
npm run test:unit -- haccp-generator
```

### Playwright
```typescript
// 2 plats → bouton grisé
await expect(page.locator('[data-testid="haccp-blocked"]')).toBeVisible()
// 3+ plats → bouton actif
await page.click('[data-testid="generate-haccp-button"]')
await page.waitForSelector('[data-testid^="ccp-"]', { timeout: 30000 })
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.4:`

## PROGRESS.md Update

Marquer Task 5.4 ✅ dans PROGRESS.md.
