# Task 5.2: Checklists Nettoyage

## Objective
Checklists pré-service, post-service, hebdomadaire, mensuelle — saisie rapide, immuables après validation (INSERT ONLY).

## Context
Les checklists HACCP sont légalement requises et tout comme les températures, elles sont immuables après validation. Des checklists par défaut sont pré-créées à la création du restaurant (via seed ou Edge Function).

## Dependencies
- Task 5.1 — pmsRouter créé, pattern INSERT ONLY établi

## Blocked By
- Task 5.1

## Implementation Plan

### Step 1: Router tRPC — checklists (ajouter au pmsRouter)

```typescript
// server/routers/pms.ts — ajouter dans pmsRouter

// ═══ CHECKLISTS ═══
getChecklists: protectedProcedure.query(async ({ ctx }) => {
  const { data } = await ctx.supabase
    .from('nettoyage_checklists')
    .select(`
      *,
      completions:nettoyage_completions(
        id, date, completee_par,
        SELECT count(*) as items_count
      )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('active', true)
    .order('type', { ascending: true })
  return data ?? []
}),

getChecklistsWithStatus: protectedProcedure
  .input(z.object({
    date: z.string().optional(), // ISO date, défaut: aujourd'hui
  }))
  .query(async ({ ctx, input }) => {
    const targetDate = input.date ?? new Date().toISOString().split('T')[0]

    const { data: checklists } = await ctx.supabase
      .from('nettoyage_checklists')
      .select('*, items:nettoyage_checklist_items(*)')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('active', true)

    const { data: completions } = await ctx.supabase
      .from('nettoyage_completions')
      .select('checklist_id, id')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('date', targetDate)

    const completedIds = new Set(completions?.map(c => c.checklist_id) ?? [])

    return (checklists ?? []).map(c => ({
      ...c,
      completed_today: completedIds.has(c.id),
    }))
  }),

saveChecklistCompletion: protectedProcedure
  .input(z.object({
    checklist_id: z.string().uuid(),
    date: z.string(),   // ISO date YYYY-MM-DD
    items_valides: z.array(z.object({
      item_id: z.string(),
      valide: z.boolean(),
      note: z.string().optional(),
    })),
    duree_minutes: z.number().int().min(0).optional(),
    notes_generales: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // INSERT UNIQUEMENT — jamais UPDATE
    const { data, error } = await ctx.supabase
      .from('nettoyage_completions')
      .insert({
        restaurant_id: ctx.restaurantId,
        checklist_id: input.checklist_id,
        date: input.date,
        items_valides: input.items_valides,
        completee_par: ctx.user.id,
        duree_minutes: input.duree_minutes,
        notes_generales: input.notes_generales,
        heure_completion: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw new Error(`Erreur checklist: ${error.message}`)
    return { id: data.id }
  }),

getChecklistHistory: protectedProcedure
  .input(z.object({
    checklist_id: z.string().uuid(),
    jours: z.number().int().min(1).max(90).default(30),
  }))
  .query(async ({ ctx, input }) => {
    const dateDebut = new Date()
    dateDebut.setDate(dateDebut.getDate() - input.jours)

    const { data } = await ctx.supabase
      .from('nettoyage_completions')
      .select('date, duree_minutes, completee_par, items_valides')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('checklist_id', input.checklist_id)
      .gte('date', dateDebut.toISOString().split('T')[0])
      .order('date', { ascending: false })

    return data ?? []
  }),
```

### Step 2: Seed checklists par défaut

```sql
-- supabase/seed.sql — checklists par défaut
-- Ces checklists sont créées pour chaque restaurant lors de l'inscription

-- Checklist pré-service (5 items)
INSERT INTO nettoyage_checklists (restaurant_id, nom, type, active) 
VALUES ($restaurant_id, 'Contrôle avant service', 'pre_service', true)
RETURNING id AS checklist_pre_id;

INSERT INTO nettoyage_checklist_items (checklist_id, ordre, description, obligatoire) VALUES
(checklist_pre_id, 1, 'Vérifier températures frigos (< 4°C)', true),
(checklist_pre_id, 2, 'Nettoyer et désinfecter les plans de travail', true),
(checklist_pre_id, 3, 'Vérifier DLC des produits en cours', true),
(checklist_pre_id, 4, 'Contrôler l''état des équipements de cuisson', true),
(checklist_pre_id, 5, 'S''assurer du lavage des mains obligatoire', true);

-- Checklist post-service (5 items)
INSERT INTO nettoyage_checklists (restaurant_id, nom, type, active)
VALUES ($restaurant_id, 'Nettoyage après service', 'post_service', true)
RETURNING id AS checklist_post_id;

INSERT INTO nettoyage_checklist_items (checklist_id, ordre, description, obligatoire) VALUES
(checklist_post_id, 1, 'Nettoyer friteuses et plaques de cuisson', true),
(checklist_post_id, 2, 'Relever et noter les températures des frigos', true),
(checklist_post_id, 3, 'Emballer et étiqueter les restes avec DLC', true),
(checklist_post_id, 4, 'Nettoyer et désinfecter les surfaces de contact', true),
(checklist_post_id, 5, 'Balayer et laver le sol de la cuisine', true);
```

**Note**: La création des checklists par défaut doit aussi être déclenchée lors de l'inscription d'un nouveau restaurant (via Edge Function ou trigger `after_restaurant_created`).

### Step 3: Composant Checklist

```typescript
// components/pms/Checklist.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface ChecklistItem {
  id: string
  description: string
  obligatoire: boolean
}

interface ChecklistProps {
  checklist: {
    id: string
    nom: string
    type: string
    items: ChecklistItem[]
    completed_today: boolean
  }
  date: string
  onCompleted: () => void
}

export function Checklist({ checklist, date, onCompleted }: ChecklistProps) {
  const [itemStates, setItemStates] = useState<Record<string, boolean>>(
    Object.fromEntries(checklist.items.map(item => [item.id, false]))
  )
  const [startTime] = useState(Date.now())

  const save = trpc.pms.saveChecklistCompletion.useMutation({
    onSuccess: () => onCompleted(),
  })

  const toggleItem = (id: string) => setItemStates(s => ({ ...s, [id]: !s[id] }))

  const allRequired = checklist.items
    .filter(i => i.obligatoire)
    .every(i => itemStates[i.id])

  const handleSubmit = () => {
    const duree = Math.round((Date.now() - startTime) / 60000)
    save.mutate({
      checklist_id: checklist.id,
      date,
      items_valides: checklist.items.map(item => ({
        item_id: item.id,
        valide: itemStates[item.id] ?? false,
      })),
      duree_minutes: duree,
    })
  }

  if (checklist.completed_today) {
    return (
      <div className="bg-green-50 rounded-2xl p-4 border border-green-200" data-testid={`checklist-done-${checklist.id}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-success">{checklist.nom}</p>
            <p className="text-xs text-gray-500">Complétée aujourd'hui</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid={`checklist-${checklist.id}`}>
      <h3 className="font-semibold text-gray-900 mb-3">{checklist.nom}</h3>

      <div className="space-y-2 mb-4">
        {checklist.items.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
              itemStates[item.id] ? 'bg-success/10 border border-success/30' : 'bg-gray-50 border border-gray-200'
            }`}
            data-testid={`checklist-item-${item.id}`}
          >
            <span className={`text-2xl ${itemStates[item.id] ? 'opacity-100' : 'opacity-30'}`}>✓</span>
            <span className={`text-sm ${itemStates[item.id] ? 'text-success line-through' : 'text-gray-700'}`}>
              {item.description}
              {item.obligatoire && <span className="text-danger ml-1">*</span>}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allRequired || save.isPending}
        className="w-full py-4 bg-success text-white font-semibold rounded-2xl disabled:opacity-50"
        data-testid={`validate-checklist-${checklist.id}`}
      >
        {save.isPending ? 'Enregistrement...' : allRequired ? '✓ Valider la checklist' : `${checklist.items.filter(i => i.obligatoire && !itemStates[i.id]).length} item(s) requis restants`}
      </button>
    </div>
  )
}
```

### Step 4: Page checklists

```typescript
// app/(app)/pms/checklists/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { Checklist } from '@/components/pms/Checklist'

export default function ChecklistsPage() {
  const today = new Date().toISOString().split('T')[0]
  const { data: checklists, refetch } = trpc.pms.getChecklistsWithStatus.useQuery({ date: today })

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-2">Checklists</h1>
      <p className="text-sm text-gray-400 mb-6">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="space-y-3">
        {checklists?.map(checklist => (
          <Checklist
            key={checklist.id}
            checklist={checklist}
            date={today}
            onCompleted={refetch}
          />
        ))}
      </div>
    </div>
  )
}
```

### Step 5: pgTAP — immuabilité completions

```sql
-- supabase/tests/rls_immutability.test.sql — ajouter:

-- nettoyage_completions immuable
SELECT throws_ok(
  $$UPDATE nettoyage_completions SET notes_generales = 'modifié' WHERE id = (SELECT id FROM nettoyage_completions LIMIT 1)$$,
  'UPDATE nettoyage_completions interdit'
);
```

### Step 6: Tests

```typescript
// tests/unit/pms-checklists.test.ts
import { describe, it, expect } from 'vitest'

describe('Checklist validation', () => {
  it('peut valider si tous les items obligatoires sont cochés', () => {
    const items = [
      { id: '1', obligatoire: true },
      { id: '2', obligatoire: true },
      { id: '3', obligatoire: false },
    ]
    const checked = { '1': true, '2': true, '3': false }
    const allRequired = items.filter(i => i.obligatoire).every(i => checked[i.id])
    expect(allRequired).toBe(true)
  })

  it('ne peut pas valider si item obligatoire non coché', () => {
    const items = [{ id: '1', obligatoire: true }, { id: '2', obligatoire: true }]
    const checked = { '1': true, '2': false }
    const allRequired = items.filter(i => i.obligatoire).every(i => checked[i.id])
    expect(allRequired).toBe(false)
  })
})
```

## Files to Create

- `app/(app)/pms/checklists/page.tsx`
- `components/pms/Checklist.tsx`
- `tests/unit/pms-checklists.test.ts`

## Files to Modify

- `server/routers/pms.ts` — ajouter getChecklists, getChecklistsWithStatus, saveChecklistCompletion, getChecklistHistory
- `supabase/seed.sql` — checklists par défaut
- `supabase/tests/rls_immutability.test.sql` — ajouter test nettoyage_completions

## Contracts

### Provides (pour tâches suivantes)
- `trpc.pms.saveChecklistCompletion(...)` → INSERT ONLY
- `trpc.pms.getChecklistsWithStatus({ date })` → liste avec `completed_today`
- Checklists par défaut créées à l'inscription

### Consumes (de Task 5.1)
- `pmsRouter` (extend)
- Pattern INSERT ONLY établi

## Acceptance Criteria

- [ ] Checklist pré-service : 5 items, validation en < 60s
- [ ] Après validation → checklist marquée "Complète" pour la journée
- [ ] Historique 30 derniers jours consultable
- [ ] Tenter UPDATE nettoyage_completions → impossible (pgTAP)
- [ ] Items obligatoires bloquent la validation si non cochés

## Testing Protocol

### pgTAP
```bash
supabase test db
```

### Playwright
```typescript
await page.goto('/pms/checklists')
// Cliquer tous les items
for (const item of await page.locator('[data-testid^="checklist-item-"]').all()) {
  await item.click()
}
// Valider
await page.click('[data-testid^="validate-checklist-"]')
// Vérifier: checklist marquée comme complète
await expect(page.locator('[data-testid^="checklist-done-"]')).toBeVisible()
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.2:`

## PROGRESS.md Update

Marquer Task 5.2 ✅ dans PROGRESS.md.
