# Task 4.3: Realtime Dashboard (Supabase Realtime)

## Objective
Dashboard mis à jour automatiquement quand des ventes sont saisies ou des prix modifiés — via WebSocket Supabase Realtime (pas de polling).

## Context
Le realtime permet à un restaurateur de voir ses données mises à jour en temps réel sans rechargement. C'est important quand plusieurs personnes utilisent l'app simultanément (ou pour la démo).

## Dependencies
- Task 4.2 — dashboard opérationnel

## Blocked By
- Task 4.2

## Implementation Plan

### Step 1: Hook useDashboardRealtime

```typescript
// hooks/useDashboardRealtime.ts
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantStore } from '@/stores/restaurant'
import { trpc } from '@/lib/trpc/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useDashboardRealtime() {
  const restaurantId = useRestaurantStore(s => s.restaurantId)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (!restaurantId) return

    const supabase = createClient()
    let channel: RealtimeChannel

    channel = supabase
      .channel(`dashboard-${restaurantId}`)
      // Écouter les nouvelles ventes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ventes',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          // Invalider le cache TanStack Query → refetch automatique
          utils.dashboard.get.invalidate()
          utils.dashboard.getVentesSemaine.invalidate()
        }
      )
      // Écouter les mises à jour de cout_de_revient
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plats',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          utils.dashboard.get.invalidate()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useDashboardRealtime] Connected to realtime')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, utils])
}
```

### Step 2: Intégrer dans la page dashboard

```typescript
// app/(app)/dashboard/page.tsx — ajouter le hook
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime'

export default function DashboardPage() {
  // Activer realtime
  useDashboardRealtime()
  
  // ... reste du composant inchangé
}
```

### Step 3: Indicateur visuel de connexion realtime

```typescript
// components/dashboard/RealtimeIndicator.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantStore } from '@/stores/restaurant'

export function RealtimeIndicator() {
  const [connected, setConnected] = useState(false)
  const restaurantId = useRestaurantStore(s => s.restaurantId)

  useEffect(() => {
    if (!restaurantId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`indicator-${restaurantId}`)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  return (
    <div className="flex items-center gap-1.5" title={connected ? 'Données en temps réel' : 'Reconnexion...'}>
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-gray-300'}`} />
      {!connected && <span className="text-xs text-gray-400">Reconnexion...</span>}
    </div>
  )
}
```

### Step 4: Tests

```typescript
// tests/unit/realtime.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}
const mockRemoveChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  }),
}))

vi.mock('@/stores/restaurant', () => ({
  useRestaurantStore: vi.fn((selector) => selector({ restaurantId: 'test-restaurant-id' })),
}))

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: vi.fn(() => ({
      dashboard: {
        get: { invalidate: vi.fn() },
        getVentesSemaine: { invalidate: vi.fn() },
      },
    })),
  },
}))

describe('useDashboardRealtime', () => {
  it('subscribe est appelé sur un channel Supabase', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useDashboardRealtime } = await import('@/hooks/useDashboardRealtime')
    renderHook(() => useDashboardRealtime())
    expect(mockChannel.subscribe).toHaveBeenCalled()
  })

  it('removeChannel est appelé au démontage (pas de fuite mémoire)', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useDashboardRealtime } = await import('@/hooks/useDashboardRealtime')
    const { unmount } = renderHook(() => useDashboardRealtime())
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
```

### Step 5: Test E2E multi-onglet

```typescript
// tests/e2e/dashboard-realtime.spec.ts
import { test, expect } from '@playwright/test'

test('dashboard mis à jour quand ventes saisies dans un autre onglet', async ({ browser }) => {
  // Contexte 1: dashboard ouvert
  const page1 = await browser.newPage()
  await page1.goto('/dashboard')
  const initialCA = await page1.locator('[data-testid="ca-value"]').textContent()

  // Contexte 2: saisir des ventes
  const page2 = await browser.newPage()
  await page2.goto('/dashboard/saisie-ventes')
  await page2.fill('[data-testid="ventes-couverts"]', '10')
  await page2.fill('[data-testid="ventes-panier"]', '30')
  await page2.click('[data-testid="save-ventes-button"]')
  await page2.waitForSelector('text=Ventes enregistrées')

  // Vérifier que page1 se met à jour en < 3s
  await page1.waitForFunction(
    (oldCA) => document.querySelector('[data-testid="ca-value"]')?.textContent !== oldCA,
    initialCA,
    { timeout: 3000 }
  )

  const newCA = await page1.locator('[data-testid="ca-value"]').textContent()
  expect(newCA).not.toBe(initialCA)
})
```

## Files to Create

- `hooks/useDashboardRealtime.ts`
- `components/dashboard/RealtimeIndicator.tsx`
- `tests/unit/realtime.test.ts`
- `tests/e2e/dashboard-realtime.spec.ts`

## Files to Modify

- `app/(app)/dashboard/page.tsx` — intégrer `useDashboardRealtime()` + `RealtimeIndicator`

## Contracts

### Provides (pour tâches suivantes)
- `useDashboardRealtime()` hook réutilisable
- Dashboard mis à jour automatiquement sur INSERT ventes
- Dashboard mis à jour sur UPDATE plats.cout_de_revient

### Consumes (de Task 4.2)
- `trpc.dashboard.get.invalidate()` + `getVentesSemaine.invalidate()`
- `createClient()` Supabase browser
- `restaurant_id` depuis Zustand store

## Acceptance Criteria

- [ ] Saisir vente dans onglet 2 → dashboard onglet 1 mis à jour en < 3s
- [ ] Pas de fuite mémoire (channel removeChannel au démontage — test Vitest)
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- realtime
```

### Playwright multi-onglet
```bash
npx playwright test tests/e2e/dashboard-realtime.spec.ts
```

## Git

- Branch: `phase-4/piloter`
- Commit message prefix: `Task 4.3:`

## PROGRESS.md Update

Marquer Task 4.3 ✅ dans PROGRESS.md.
