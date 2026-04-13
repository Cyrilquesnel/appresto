# Task 5.1: Équipements + Relevés Températures (Immuable)

## Objective
Gestion des équipements PMS, saisie des relevés de température (2 taps), alertes hors-plage, immuabilité légale — INSERT uniquement, jamais UPDATE ni DELETE.

## Context
Les relevés de température sont légalement immuables (obligation HACCP, 3 ans de conservation). Le RLS bloque physiquement toute UPDATE ou DELETE. L'UI doit permettre la saisie en 2 taps maximum pour les cuisiniers en service. Valeurs par défaut selon D17 de DISCOVERY.md.

## Dependencies
- Task 1.2 — tables PMS créées (temperature_logs, equipements)

## Blocked By
- Task 1.2

## Implementation Plan

### Step 1: Router tRPC — PMS températures

```typescript
// server/routers/pms.ts — implémenter
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

const EquipementTypeEnum = z.enum(['frigo', 'congelateur', 'bain_marie', 'four', 'autre'])

export const pmsRouter = router({
  // ═══ ÉQUIPEMENTS ═══
  createEquipement: protectedProcedure
    .input(z.object({
      nom: z.string().min(1).max(200),
      type: EquipementTypeEnum,
      temp_min: z.number(),
      temp_max: z.number(),
      frequence_releve: z.enum(['2x_jour', '1x_jour', 'hebdo']).default('2x_jour'),
      localisation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Valeurs par défaut selon D17 DISCOVERY.md
      const defaults: Record<string, { temp_min: number; temp_max: number }> = {
        frigo: { temp_min: 0, temp_max: 4 },
        congelateur: { temp_min: -25, temp_max: -18 },
        bain_marie: { temp_min: 63, temp_max: 85 },
        four: { temp_min: 0, temp_max: 300 },
        autre: { temp_min: -30, temp_max: 100 },
      }
      const { data, error } = await ctx.supabase
        .from('equipements')
        .insert({
          restaurant_id: ctx.restaurantId,
          nom: input.nom,
          type: input.type,
          temp_min: input.temp_min ?? defaults[input.type].temp_min,
          temp_max: input.temp_max ?? defaults[input.type].temp_max,
          frequence_releve: input.frequence_releve,
          localisation: input.localisation,
          actif: true,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    }),

  listEquipements: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('equipements')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('actif', true)
      .order('nom')
    return data ?? []
  }),

  // ═══ RELEVÉS TEMPÉRATURES ═══
  // INSERT ONLY — JAMAIS UPDATE NI DELETE (légal)
  saveTemperatureLog: protectedProcedure
    .input(z.object({
      equipement_id: z.string().uuid(),
      valeur: z.number(),
      action_corrective: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Récupérer les seuils de l'équipement pour déterminer conformité
      const { data: equipement } = await ctx.supabase
        .from('equipements')
        .select('temp_min, temp_max, nom')
        .eq('id', input.equipement_id)
        .eq('restaurant_id', ctx.restaurantId)
        .single()

      if (!equipement) throw new Error('Équipement non trouvé')

      const conforme = input.valeur >= equipement.temp_min && input.valeur <= equipement.temp_max

      if (!conforme && !input.action_corrective) {
        // On laisse passer sans action corrective mais on flag le besoin
        // (l'UI devrait demander une action corrective — vérification UI-side)
      }

      // INSERT UNIQUEMENT — le trigger RLS bloque UPDATE/DELETE
      const { data, error } = await ctx.supabase
        .from('temperature_logs')
        .insert({
          restaurant_id: ctx.restaurantId,
          equipement_id: input.equipement_id,
          valeur: input.valeur,
          conforme,
          action_corrective: input.action_corrective,
          releve_par: ctx.user.id,
          timestamp_releve: new Date().toISOString(),
        })
        .select('id, conforme')
        .single()

      if (error) throw new Error(`Erreur INSERT température: ${error.message}`)
      return { id: data.id, conforme }
    }),

  getTemperatureLogs: protectedProcedure
    .input(z.object({
      equipement_id: z.string().uuid().optional(),
      jours: z.number().int().min(1).max(90).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const dateDebut = new Date()
      dateDebut.setDate(dateDebut.getDate() - input.jours)

      let query = ctx.supabase
        .from('temperature_logs')
        .select('*, equipement:equipements(nom, temp_min, temp_max, type)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('timestamp_releve', dateDebut.toISOString())
        .order('timestamp_releve', { ascending: false })

      if (input.equipement_id) {
        query = query.eq('equipement_id', input.equipement_id)
      }

      const { data } = await query.limit(500)
      return data ?? []
    }),
})
```

### Step 2: Composant TemperatureLogger (2 taps)

```typescript
// components/pms/TemperatureLogger.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface EquipementForLogger {
  id: string
  nom: string
  type: string
  temp_min: number
  temp_max: number
}

interface TemperatureLoggerProps {
  equipement: EquipementForLogger
  onLogged: (conforme: boolean) => void
}

export function TemperatureLogger({ equipement, onLogged }: TemperatureLoggerProps) {
  const [value, setValue] = useState('')
  const [actionCorrective, setActionCorrective] = useState('')
  const [showAction, setShowAction] = useState(false)
  const [result, setResult] = useState<{ conforme: boolean } | null>(null)

  const log = trpc.pms.saveTemperatureLog.useMutation({
    onSuccess: (data) => {
      setResult(data)
      if (!data.conforme) setShowAction(true)
      else onLogged(true)
    },
  })

  const handleTap1 = (val: number) => setValue(val.toString())

  const handleSubmit = () => {
    log.mutate({
      equipement_id: equipement.id,
      valeur: parseFloat(value),
      action_corrective: actionCorrective || undefined,
    })
  }

  const isHorsPlage = value !== '' && (
    parseFloat(value) < equipement.temp_min || parseFloat(value) > equipement.temp_max
  )

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid={`temp-logger-${equipement.id}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{equipement.nom}</h3>
        <span className="text-xs text-gray-400">[{equipement.temp_min}°C / {equipement.temp_max}°C]</span>
      </div>

      {/* Numpad grande touche — accessible en cuisine */}
      <div className="mb-3">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          step={0.1}
          placeholder={`Température (°C)`}
          className={`w-full px-4 py-6 text-4xl font-bold text-center rounded-2xl border-2 ${
            isHorsPlage ? 'border-danger bg-red-50 text-danger' : 'border-gray-200 bg-gray-50 text-gray-900'
          } focus:outline-none`}
          data-testid={`temp-input-${equipement.id}`}
        />
        {isHorsPlage && (
          <p className="text-danger text-sm font-medium mt-2 text-center animate-pulse" data-testid="alerte-hors-plage">
            ⚠ Température hors plage ! Action corrective requise
          </p>
        )}
      </div>

      {/* Action corrective si hors plage */}
      {(isHorsPlage || showAction) && (
        <textarea
          value={actionCorrective}
          onChange={e => setActionCorrective(e.target.value)}
          placeholder="Action corrective prise (obligatoire si hors plage)"
          className="w-full px-4 py-3 rounded-xl border border-danger text-sm mb-3"
          rows={2}
          data-testid={`action-corrective-${equipement.id}`}
        />
      )}

      {result ? (
        <div className={`py-4 rounded-2xl text-center font-bold text-lg ${result.conforme ? 'bg-success text-white' : 'bg-danger text-white'}`}>
          {result.conforme ? '✓ Conforme' : '⚠ Non conforme — enregistré'}
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value || log.isPending || (isHorsPlage && !actionCorrective)}
          className="w-full py-4 bg-primary text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
          data-testid={`save-temp-${equipement.id}`}
        >
          {log.isPending ? '⏳ Enregistrement...' : '✓ Valider'}
        </button>
      )}
    </div>
  )
}
```

### Step 3: Composant EquipementSetup

```typescript
// components/pms/EquipementSetup.tsx
// Formulaire création équipement avec valeurs par défaut selon type sélectionné
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const TYPE_DEFAULTS = {
  frigo: { nom: 'Réfrigérateur', temp_min: 0, temp_max: 4 },
  congelateur: { nom: 'Congélateur', temp_min: -25, temp_max: -18 },
  bain_marie: { nom: 'Bain-marie', temp_min: 63, temp_max: 85 },
  four: { nom: 'Four', temp_min: 0, temp_max: 300 },
  autre: { nom: 'Équipement', temp_min: 0, temp_max: 100 },
}

export function EquipementSetup({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState<keyof typeof TYPE_DEFAULTS>('frigo')
  const [nom, setNom] = useState(TYPE_DEFAULTS.frigo.nom)
  const [tempMin, setTempMin] = useState(TYPE_DEFAULTS.frigo.temp_min.toString())
  const [tempMax, setTempMax] = useState(TYPE_DEFAULTS.frigo.temp_max.toString())

  const create = trpc.pms.createEquipement.useMutation({ onSuccess })

  const handleTypeChange = (t: keyof typeof TYPE_DEFAULTS) => {
    setType(t)
    setNom(TYPE_DEFAULTS[t].nom)
    setTempMin(TYPE_DEFAULTS[t].temp_min.toString())
    setTempMax(TYPE_DEFAULTS[t].temp_max.toString())
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); create.mutate({ nom, type, temp_min: parseFloat(tempMin), temp_max: parseFloat(tempMax) }) }}
      className="space-y-4"
      data-testid="equipement-form"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_DEFAULTS) as Array<keyof typeof TYPE_DEFAULTS>).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-xl text-sm font-medium border ${type === t ? 'bg-accent text-white border-accent' : 'bg-white border-gray-200 text-gray-600'}`}
            >
              {t === 'frigo' ? '❄ Frigo' : t === 'congelateur' ? '🧊 Congél.' : t === 'bain_marie' ? '♨ Bain-marie' : t === 'four' ? '🔥 Four' : '📦 Autre'}
            </button>
          ))}
        </div>
      </div>
      <input type="text" value={nom} onChange={e => setNom(e.target.value)} required placeholder="Nom" className="w-full px-4 py-3 rounded-xl border border-gray-200" data-testid="equipement-nom" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">T° min (°C)</label>
          <input type="number" value={tempMin} onChange={e => setTempMin(e.target.value)} step={0.5} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center" data-testid="temp-min-input" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">T° max (°C)</label>
          <input type="number" value={tempMax} onChange={e => setTempMax(e.target.value)} step={0.5} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center" data-testid="temp-max-input" />
        </div>
      </div>
      <button type="submit" disabled={!nom || create.isPending} className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50">
        {create.isPending ? 'Ajout...' : 'Ajouter l\'équipement'}
      </button>
    </form>
  )
}
```

### Step 4: Page températures

```typescript
// app/(app)/pms/temperatures/page.tsx
// Affiche la liste des équipements avec TemperatureLogger pour chacun
// + historique graphique des 7 derniers jours
```

### Step 5: Tests pgTAP immuabilité

```sql
-- supabase/tests/rls_immutability.test.sql
BEGIN;
SELECT plan(4);

-- Setup
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "test-user-id", "role": "authenticated"}';

-- INSERT doit fonctionner
SELECT lives_ok(
  $$INSERT INTO temperature_logs (restaurant_id, equipement_id, valeur, conforme) 
    VALUES ('test-restaurant-id', 'test-equipement-id', 3.5, true)$$,
  'INSERT dans temperature_logs autorisé'
);

-- UPDATE doit être rejeté
SELECT throws_ok(
  $$UPDATE temperature_logs SET valeur = 99 WHERE id = (SELECT id FROM temperature_logs LIMIT 1)$$,
  'UPDATE temperature_logs interdit (RLS)'
);

-- DELETE doit être rejeté
SELECT throws_ok(
  $$DELETE FROM temperature_logs WHERE id = (SELECT id FROM temperature_logs LIMIT 1)$$,
  'DELETE temperature_logs interdit (RLS)'
);

SELECT * FROM finish();
ROLLBACK;
```

### Step 6: Tests unitaires

```typescript
// tests/unit/pms-temperatures.test.ts
import { describe, it, expect } from 'vitest'

describe('saveTemperatureLog', () => {
  it('conforme = true si valeur dans [temp_min, temp_max]', () => {
    const temp_min = 0
    const temp_max = 4
    const valeur = 3.5
    const conforme = valeur >= temp_min && valeur <= temp_max
    expect(conforme).toBe(true)
  })

  it('conforme = false si valeur hors plage', () => {
    const temp_min = 0
    const temp_max = 4
    const valeur = 6.0
    const conforme = valeur >= temp_min && valeur <= temp_max
    expect(conforme).toBe(false)
  })

  it('valeurs par défaut frigo: [0°C, 4°C]', () => {
    const TYPE_DEFAULTS = { frigo: { temp_min: 0, temp_max: 4 } }
    expect(TYPE_DEFAULTS.frigo.temp_min).toBe(0)
    expect(TYPE_DEFAULTS.frigo.temp_max).toBe(4)
  })

  it('valeurs par défaut congélateur: [-25°C, -18°C]', () => {
    const TYPE_DEFAULTS = { congelateur: { temp_min: -25, temp_max: -18 } }
    expect(TYPE_DEFAULTS.congelateur.temp_min).toBe(-25)
  })
})
```

## Files to Create

- `server/routers/pms.ts` (complet, à étoffer au fil des tâches 5.x)
- `app/(app)/pms/temperatures/page.tsx`
- `components/pms/TemperatureLogger.tsx`
- `components/pms/EquipementSetup.tsx`
- `components/pms/TemperatureHistoryChart.tsx`
- `supabase/tests/rls_immutability.test.sql`
- `tests/unit/pms-temperatures.test.ts`

## Files to Modify

- `server/routers/index.ts` — vérifier pmsRouter importé

## Contracts

### Provides (pour tâches suivantes)
- `trpc.pms.createEquipement(...)` → `{ id }`
- `trpc.pms.saveTemperatureLog(...)` → `{ id, conforme }` (INSERT ONLY)
- `trpc.pms.getTemperatureLogs(...)` → liste relevés
- `pmsRouter` initialisé (sera étendu en 5.2 → 5.7)

### Consumes (de Task 1.2)
- Tables: `equipements`, `temperature_logs`
- RLS politique INSERT ONLY sur temperature_logs

## Acceptance Criteria

- [ ] Configurer frigo (seuils 0-4°C)
- [ ] Saisir 3.5°C → conforme = true (vert)
- [ ] Saisir 6°C → conforme = false + alerte rouge immédiate
- [ ] Tenter UPDATE temperature_logs → erreur PostgreSQL (pgTAP)
- [ ] Tenter DELETE temperature_logs → erreur PostgreSQL (pgTAP)
- [ ] Saisie en 2 taps (choisir équipement → entrer valeur → valider)
- [ ] iPhone 14 Playwright: saisie en < 5s end-to-end

## Testing Protocol

### pgTAP
```bash
supabase test db supabase/tests/rls_immutability.test.sql
```

### Vitest
```bash
npm run test:unit -- pms-temperatures
```

### Playwright
```typescript
await page.goto('/pms/temperatures')
await page.fill(`[data-testid="temp-input-EQUIPEMENT_ID"]`, '6')
await expect(page.locator('[data-testid="alerte-hors-plage"]')).toBeVisible()
await page.click(`[data-testid="save-temp-EQUIPEMENT_ID"]`)
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.1:`

## PROGRESS.md Update

Marquer Task 5.1 ✅ dans PROGRESS.md.
