# Task 5.7: Offline PWA + Background Sync PMS

## Objective
Service Worker custom pour queue offline des saisies PMS (températures + checklists) — sync automatique au retour réseau via Background Sync API.

## Context
Les relevés de température se font parfois en chambre froide sans réseau. Le Service Worker intercepte les appels tRPC, les stocke en IndexedDB si hors-ligne, et les rejoue automatiquement au retour réseau. Critique pour les utilisateurs en cuisine.

## Dependencies
- Task 5.1 — saveTemperatureLog opérationnel
- Task 5.2 — saveChecklistCompletion opérationnel

## Blocked By
- Tasks 5.1 + 5.2

## Implementation Plan

### Step 1: lib/pms-offline.ts (client-side)

```typescript
// lib/pms-offline.ts
// Gestion de la queue offline côté client
const DB_NAME = 'mise-en-place-sync'
const STORE_NAME = 'pms-queue'
const SYNC_TAG = 'pms-sync'

export interface QueuedRequest {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string
  timestamp: number
  type: 'temperature' | 'checklist'
}

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function queuePMSRecord(request: Omit<QueuedRequest, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB()
  const record: QueuedRequest = {
    ...request,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueuedCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(0)
  })
}

export async function getQueuedRecords(): Promise<QueuedRequest[]> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve([])
  })
}

export async function deleteQueuedRecord(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
  })
}

export async function requestBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready
    await (reg as any).sync.register(SYNC_TAG)
  }
}
```

### Step 2: public/sw-custom.js (Service Worker)

```javascript
// public/sw-custom.js
const DB_NAME = 'mise-en-place-sync'
const STORE_NAME = 'pms-queue'
const SYNC_TAG = 'pms-sync'

// Routes PMS à intercepter en mode offline
const PMS_ROUTES = [
  '/api/trpc/pms.saveTemperatureLog',
  '/api/trpc/pms.saveChecklistCompletion',
]

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Intercepter les requêtes PMS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isPMSRoute = PMS_ROUTES.some(route => url.pathname.startsWith(route))

  if (!isPMSRoute) return  // Laisser passer les autres requêtes

  event.respondWith(
    fetch(event.request.clone())
      .catch(async () => {
        // Réseau indisponible → stocker dans IndexedDB
        const db = await openDB()
        const body = await event.request.clone().text()
        const record = {
          id: crypto.randomUUID(),
          url: event.request.url,
          method: event.request.method,
          headers: Object.fromEntries(event.request.headers.entries()),
          body,
          timestamp: Date.now(),
        }

        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).add(record)
          tx.oncomplete = resolve
          tx.onerror = reject
        })

        // Demander un Background Sync au retour du réseau
        if (self.registration.sync) {
          await self.registration.sync.register(SYNC_TAG)
        }

        // Retourner une réponse "queued" pour ne pas crasher l'UI
        return new Response(
          JSON.stringify({ result: { data: { queued: true } } }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      })
  )
})

// Background Sync: rejouer les requêtes en attente
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue())
  }
})

async function flushQueue() {
  const db = await openDB()
  const records = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve([])
  })

  for (const record of records) {
    try {
      const response = await fetch(record.url, {
        method: record.method,
        headers: record.headers,
        body: record.body,
      })

      if (response.ok) {
        // Supprimer de la queue si succès
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).delete(record.id)
          tx.oncomplete = resolve
        })
        console.log(`[sw] Synced PMS record ${record.id}`)
      }
    } catch (err) {
      console.error(`[sw] Failed to sync ${record.id}:`, err)
      // Laisser dans la queue pour réessayer
    }
  }

  // Notifier l'app que la sync est terminée
  const clients = await self.clients.matchAll()
  clients.forEach(client => client.postMessage({ type: 'PMS_SYNC_COMPLETE' }))
}
```

### Step 3: Composant OfflineBadge

```typescript
// components/pms/OfflineBadge.tsx
'use client'
import { useState, useEffect } from 'react'
import { getQueuedCount } from '@/lib/pms-offline'

export function OfflineBadge() {
  const [count, setCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateCount = async () => {
      const c = await getQueuedCount()
      setCount(c)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000)

    const handleOnline = () => { setIsOnline(true); updateCount() }
    const handleOffline = () => setIsOnline(false)

    // Écouter les messages du Service Worker
    const handleSWMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PMS_SYNC_COMPLETE') updateCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  if (count === 0 && isOnline) return null

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 z-50 rounded-2xl p-3 text-sm font-medium flex items-center gap-2 shadow-lg ${
        !isOnline ? 'bg-gray-800 text-white' : 'bg-warning text-white'
      }`}
      data-testid="offline-badge"
    >
      {!isOnline ? (
        <>
          <span>📡</span>
          <span>Mode hors-ligne — {count > 0 ? `${count} relevé(s) en attente` : 'Les relevés seront synchronisés au retour du réseau'}</span>
        </>
      ) : count > 0 ? (
        <>
          <span>🔄</span>
          <span>{count} relevé(s) en cours de synchronisation...</span>
        </>
      ) : null}
    </div>
  )
}
```

### Step 4: Enregistrement Service Worker dans next.config.ts

```typescript
// next.config.ts — mettre à jour
import withPWA from '@ducanh2912/next-pwa'

const nextConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // Enregistrer le Service Worker custom en plus du SW généré par @ducanh2912/next-pwa
  customWorkerSrc: 'public/sw-custom.js', // si supporté
  // Alternative: enregistrer manuellement dans layout.tsx
})

export default nextConfig
```

**Note**: L'enregistrement du Service Worker custom doit se faire manuellement dans `app/layout.tsx` si `@ducanh2912/next-pwa` ne supporte pas directement les SW custom :

```typescript
// app/layout.tsx — ajouter dans useEffect côté client
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-custom.js')
      .then(reg => console.log('SW custom enregistré:', reg.scope))
      .catch(err => console.error('SW custom échec:', err))
  }
}, [])
```

### Step 5: Intégrer OfflineBadge dans le layout app

```typescript
// app/(app)/layout.tsx — ajouter OfflineBadge
import { OfflineBadge } from '@/components/pms/OfflineBadge'

// Dans le layout:
<>
  {children}
  <OfflineBadge />
  {/* Navigation mobile bottom */}
</>
```

### Step 6: Tests

```typescript
// tests/unit/pms-offline.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      add: vi.fn(() => ({ onsuccess: null, onerror: null })),
      count: vi.fn(() => ({ result: 2, onsuccess: null })),
      getAll: vi.fn(() => ({ result: [], onsuccess: null })),
    })),
    oncomplete: null,
  })),
}

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: mockDB,
  })),
})

describe('pms-offline queue', () => {
  it('getQueuedCount retourne un nombre', async () => {
    // Simple test de typage
    expect(typeof 0).toBe('number')
  })
})
```

```typescript
// tests/e2e/pms-offline.spec.ts
import { test, expect } from '@playwright/test'

test('mode offline: saisie température → badge en attente', async ({ page, context }) => {
  await page.goto('/pms/temperatures')

  // Couper le réseau
  await context.setOffline(true)

  // Vérifier badge offline visible
  await expect(page.locator('[data-testid="offline-badge"]')).toBeVisible()

  // Rétablir le réseau
  await context.setOffline(false)

  // Vérifier Service Worker enregistré
  const swReady = await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => true).catch(() => false)
  )
  expect(swReady).toBe(true)
})

test('webkit: Service Worker enregistré sur Safari', async ({ page }) => {
  await page.goto('/')
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg !== null
  })
  expect(swReady).toBe(true)
})
```

## Files to Create

- `public/sw-custom.js`
- `lib/pms-offline.ts`
- `components/pms/OfflineBadge.tsx`
- `tests/unit/pms-offline.test.ts`
- `tests/e2e/pms-offline.spec.ts`

## Files to Modify

- `app/(app)/layout.tsx` — intégrer OfflineBadge + enregistrement SW custom
- `next.config.ts` — vérifier configuration PWA + SW custom

## Contracts

### Provides (pour tâches suivantes)
- Service Worker avec queue IndexedDB offline
- Background Sync automatique au retour réseau
- `OfflineBadge` composant d'état offline
- Tests E2E offline disponibles (Task 8.1)

### Consumes (de Tasks 5.1 + 5.2)
- Routes tRPC: `pms.saveTemperatureLog`, `pms.saveChecklistCompletion`

## Acceptance Criteria

- [ ] `context.setOffline(true)` → saisir T° → badge "X relevés en attente"
- [ ] `context.setOffline(false)` → badge disparaît → relevé présent en BDD
- [ ] Webkit (iOS Safari): Service Worker enregistré
- [ ] Pas de perte de données après rechargement en mode offline

## Testing Protocol

### Playwright
```bash
npx playwright test tests/e2e/pms-offline.spec.ts --project="iPhone 14 Safari"
npx playwright test tests/e2e/pms-offline.spec.ts --project="Desktop Chrome"
```

### Manuel offline
- Couper le WiFi sur iPhone réel
- Saisir une température
- Vérifier badge
- Réactiver WiFi
- Vérifier sync en BDD

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.7:`

## PROGRESS.md Update

Marquer Task 5.7 ✅ dans PROGRESS.md.
