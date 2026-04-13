# Task 6.2: PWA Manifest + Service Worker Complet

## Objective
PWA installable sur iPhone et Android avec manifest complet, icônes, share_target, mode offline partiel. Lighthouse PWA score ≥ 90.

## Context
`display: 'standalone'` dans manifest. `share_target`: permet de partager une image → `/plats/nouveau`. Meta iOS: `apple-mobile-web-app-capable: yes`. IOSInstallPrompt component affiché si non installé et non dismissed.

## Dependencies
- Task 1.1 — Next.js project bootstrapped

## Blocked By
- Task 1.1

## Implementation Plan

### Step 1: public/manifest.json

```json
{
  "name": "Mise en Place",
  "short_name": "Mise en Place",
  "description": "Gestion restauration — fiches techniques, commandes, PMS",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "background_color": "#1a3a2a",
  "theme_color": "#1a3a2a",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Tableau de bord"
    }
  ],
  "share_target": {
    "action": "/plats/nouveau",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [
        {
          "name": "photo",
          "accept": ["image/*"]
        }
      ]
    }
  },
  "categories": ["food", "business", "productivity"],
  "lang": "fr"
}
```

### Step 2: Meta tags iOS dans app/layout.tsx

```typescript
// app/layout.tsx — head section
export const metadata: Metadata = {
  title: 'Mise en Place',
  description: 'Gestion restauration — fiches techniques, commandes, PMS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mise en Place',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

// Dans le <head> HTML:
// <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
// <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
// <meta name="theme-color" content="#1a3a2a" />
```

### Step 3: Enregistrement Service Worker custom dans layout.tsx

```typescript
// app/layout.tsx — client-side useEffect (dans un composant client séparé)
// components/ServiceWorkerRegistration.tsx
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw-custom.js', { scope: '/' })
        .then(reg => {
          console.log('[SW] Registered, scope:', reg.scope)
        })
        .catch(err => {
          console.error('[SW] Registration failed:', err)
        })
    }
  }, [])

  return null
}
```

### Step 4: Handle share_target dans /plats/nouveau

```typescript
// app/(app)/plats/nouveau/page.tsx — détecter share_target
'use client'
import { useEffect, useState } from 'react'

export default function NouveauPlatPage() {
  const [sharedFile, setSharedFile] = useState<File | null>(null)

  useEffect(() => {
    // Détecter si on vient d'un share_target (POST avec FormData)
    // Le SW intercepte et stocke le fichier partagé
    const handleSharedPhoto = async () => {
      if ('launchQueue' in window) {
        (window as any).launchQueue.setConsumer(async (launchParams: any) => {
          if (!launchParams.files.length) return
          const [fileHandle] = launchParams.files
          const file = await fileHandle.getFile()
          setSharedFile(file)
        })
      }
    }
    handleSharedPhoto()
  }, [])

  // ... reste du composant, sharedFile passé à DishCamera si disponible
}
```

### Step 5: composant IOSInstallPrompt

```typescript
// components/IOSInstallPrompt.tsx
'use client'
import { useState, useEffect } from 'react'

function isIOS() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (window.navigator as any).standalone === true
}

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('ios-prompt-dismissed')
    if (isIOS() && !isInStandaloneMode() && !dismissed) {
      // Attendre 2s avant d'afficher
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4 shadow-2xl"
      data-testid="ios-install-prompt"
    >
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="Mise en Place" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">Installer Mise en Place</p>
          <p className="text-xs text-gray-500 mt-1">
            Appuyez sur <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </span> puis « Sur l'écran d'accueil »
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('ios-prompt-dismissed', '1')
            setShow(false)
          }}
          className="text-gray-400 hover:text-gray-600 p-1"
          data-testid="ios-prompt-dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

### Step 6: CSS Safe Area

```css
/* app/globals.css — ajouter */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}

/* Navigation bottom — tenir compte de la safe area */
.bottom-nav {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
```

### Step 7: next.config.ts — PWA

```typescript
// next.config.ts
import withPWA from '@ducanh2912/next-pwa'

const nextConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  swcMinify: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    exclude: [/sw-custom\.js/], // Ne pas mettre en cache le SW custom (géré séparément)
  },
})({
  // Reste de la config Next.js
  experimental: {
    typedRoutes: false,
  },
})

export default nextConfig
```

### Step 8: Tests

```typescript
// tests/e2e/pwa.spec.ts
import { test, expect } from '@playwright/test'

test('manifest.json accessible et valide', async ({ page }) => {
  const response = await page.request.get('/manifest.json')
  expect(response.status()).toBe(200)

  const manifest = await response.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.name).toBe('Mise en Place')
  expect(manifest.share_target).toBeDefined()
  expect(manifest.icons.length).toBeGreaterThan(0)
})

test('meta tags iOS présents', async ({ page }) => {
  await page.goto('/')
  const appleCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')
  expect(appleCapable).toBe('yes')
})

test('Service Worker enregistré', async ({ page }) => {
  await page.goto('/dashboard')
  const swRegistered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg !== null
  })
  expect(swRegistered).toBe(true)
})
```

## Files to Create

- `public/manifest.json`
- `public/icons/icon-192.png` (à générer avec script ou outil externe)
- `public/icons/icon-512.png`
- `public/screenshots/dashboard.png`
- `components/IOSInstallPrompt.tsx`
- `components/ServiceWorkerRegistration.tsx`
- `tests/e2e/pwa.spec.ts`

## Files to Modify

- `app/layout.tsx` — meta tags iOS + ServiceWorkerRegistration + IOSInstallPrompt
- `next.config.ts` — withPWA config
- `app/globals.css` — safe-area CSS variables

## Acceptance Criteria

- [ ] Chrome "Installer l'application" disponible (Lighthouse PWA score ≥ 90)
- [ ] Sur iOS: IOSInstallPrompt affiché si non installé
- [ ] App installée → démarre en mode standalone (pas de barre Safari)
- [ ] Share target: partager photo depuis galerie → ouvre l'app sur /plats/nouveau
- [ ] manifest.json → `display: 'standalone'` + `share_target` défini

## Testing Protocol

### Lighthouse
```bash
npx playwright test tests/e2e/pwa.spec.ts --project="Desktop Chrome"
npx playwright test tests/e2e/pwa.spec.ts --project="iPhone 14 Safari"
# Puis Lighthouse audit via Chrome DevTools / CLI
```

### Manuel iOS
```
1. iPhone: Safari → app URL
2. Tap Share → Sur l'écran d'accueil
3. Ouvrir depuis l'écran d'accueil → mode standalone
4. Photo app → partager → Mise en Place → /plats/nouveau
```

## Git

- Branch: `phase-6/finitions`
- Commit message prefix: `Task 6.2:`

## PROGRESS.md Update

Marquer Task 6.2 ✅ dans PROGRESS.md.
