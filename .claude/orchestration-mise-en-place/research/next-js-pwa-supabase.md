# Recherche : Next.js 14 PWA + Supabase + tRPC

**Date**: 2026-04-12
**Stack**: Next.js 14 App Router + @ducanh2912/next-pwa + Supabase SSR + tRPC v11

---

## 1. Next.js 14 App Router + PWA

### Configuration PWA (@ducanh2912/next-pwa — recommandé sur next-pwa)

```bash
npm install @ducanh2912/next-pwa
```

```typescript
// next.config.ts
import withPWA from "@ducanh2912/next-pwa";

const nextConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Cache API tRPC (stale-while-revalidate)
      {
        urlPattern: /^https:\/\/app\.miseenplace\.fr\/api\/trpc\/.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "trpc-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 300 }
        }
      },
      // Cache images Supabase Storage
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-storage",
          expiration: { maxEntries: 200, maxAgeSeconds: 86400 }
        }
      }
    ]
  }
})({
  // Config Next.js standard
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } }
})

export default nextConfig
```

### Manifest PWA

```json
// public/manifest.json
{
  "name": "Mise en Place",
  "short_name": "Mise en Place",
  "description": "Le copilote du restaurateur indépendant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/dashboard.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
  ],
  "share_target": {
    "action": "/plats/nouveau",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": { "files": [{ "name": "image", "accept": ["image/*"] }] }
  }
}
```

### Meta tags iOS (layout.tsx)

```tsx
// app/layout.tsx
export const metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mise en Place"
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover"  // Safe area iPhone
  }
}

// Dans le head HTML :
// <meta name="apple-mobile-web-app-capable" content="yes">
// <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
// <link rel="apple-touch-icon" href="/icons/icon-192.png">
```

---

## 2. Service Worker Custom — Background Sync PMS

```typescript
// public/sw-custom.js (enregistré via next-pwa)
const DB_NAME = 'mise-en-place-sync'
const STORE_NAME = 'pms-queue'

// IndexedDB pour queue offline
async function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = reject
  })
}

// Ajouter à la queue quand offline
async function queuePMSRecord(data) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ data, timestamp: Date.now() })
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}

// Background Sync : flush queue quand réseau retrouvé
self.addEventListener('sync', async (event) => {
  if (event.tag === 'pms-sync') {
    event.waitUntil(flushPMSQueue())
  }
})

async function flushPMSQueue() {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const records = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result) })

  for (const record of records) {
    try {
      await fetch('/api/trpc/pms.saveTemperatureLog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record.data)
      })
      store.delete(record.id)
    } catch (e) {
      console.error('Sync failed for record', record.id, e)
    }
  }
}

// Fetch intercept : si réseau indisponible, mettre en queue
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.includes('pms.saveTemperatureLog') || 
      url.pathname.includes('pms.saveChecklistCompletion')) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        const data = await event.request.json()
        await queuePMSRecord({ url: url.pathname, data })
        // Enregistrer Background Sync
        await self.registration.sync.register('pms-sync')
        return new Response(JSON.stringify({ queued: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
  }
})
```

---

## 3. Push Notifications PWA — iOS 16.4+

### Contraintes iOS
- **Obligatoire** : PWA doit être installée via "Ajouter à l'écran d'accueil"
- **iOS < 16.4** : pas de push du tout → fallback email obligatoire
- **iOS 16.4+** : push disponible si installé
- **Safari browser** (non installé) : aucun push possible

### Setup VAPID

```bash
npx web-push generate-vapid-keys
# → Copier dans .env : VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY
```

```typescript
// app/api/push/subscribe/route.ts
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  'mailto:support@miseenplace.fr',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: Request) {
  const subscription = await request.json()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  await supabase.from('push_subscriptions').upsert({
    user_id: user!.id,
    subscription: subscription,
    updated_at: new Date().toISOString()
  })
  
  return Response.json({ ok: true })
}

// Envoi d'une notification PMS (depuis Edge Function cron)
export async function sendPMSReminder(restaurantId: string, message: string) {
  const supabase = createServiceClient()
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('restaurant_id', restaurantId)

  for (const { subscription } of subscriptions ?? []) {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: 'Mise en Place',
      body: message,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'pms-reminder',
      data: { url: '/pms/temperatures' }
    }))
  }
}
```

### Composant "Installer l'app" (iOS prompt)

```tsx
// components/IOSInstallPrompt.tsx
'use client'
import { useState, useEffect } from 'react'

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false)
  
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('install-prompt-dismissed')
    
    if (isIOS && !isStandalone && !dismissed) {
      setShow(true)
    }
  }, [])
  
  if (!show) return null
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
      <p className="text-sm font-medium">Installez l'app pour les notifications PMS</p>
      <p className="text-xs text-gray-500 mt-1">
        Appuyez sur <strong>Partager</strong> puis <strong>"Sur l'écran d'accueil"</strong>
      </p>
      <button onClick={() => { localStorage.setItem('install-prompt-dismissed', '1'); setShow(false) }}>
        Plus tard
      </button>
    </div>
  )
}
```

---

## 4. Supabase avec Next.js App Router — @supabase/ssr

```bash
npm install @supabase/ssr @supabase/supabase-js
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        }
      }
    }
  )
}

// lib/supabase/client.ts (Client Components)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* ... */ } }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons).*)'] }
```

---

## 5. tRPC v11 — Setup App Router

```bash
npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod
```

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const createTRPCContext = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: restaurantUser } = user
    ? await supabase.from('restaurant_users').select('restaurant_id, role').eq('user_id', user.id).single()
    : { data: null }
  
  return { user, supabase, restaurantId: restaurantUser?.restaurant_id, role: restaurantUser?.role }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
      }
    }
  }
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user, restaurantId: ctx.restaurantId! } })
})

// server/routers/index.ts
import { router } from '../trpc'
import { platsRouter } from './plats'
import { fichesRouter } from './fiches'
import { commandesRouter } from './commandes'
import { dashboardRouter } from './dashboard'
import { pmsRouter } from './pms'

export const appRouter = router({
  plats: platsRouter,
  fiches: fichesRouter,
  commandes: commandesRouter,
  dashboard: dashboardRouter,
  pms: pmsRouter,
})
export type AppRouter = typeof appRouter

// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: '/api/trpc', req, router: appRouter, createContext: createTRPCContext })

export { handler as GET, handler as POST }
```

---

## 6. TanStack Query v5 + Zustand v5

```typescript
// lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers'

export const trpc = createTRPCReact<AppRouter>()

// providers.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '@/lib/trpc/client'
import superjson from 'superjson'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30 * 1000, retry: 2 } }
  }))
  const [trpcClient] = useState(() => trpc.createClient({
    links: [httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      headers() { return { 'x-restaurant-id': useRestaurantStore.getState().restaurantId ?? '' } }
    })]
  }))
  
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}

// stores/restaurant.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RestaurantStore {
  restaurantId: string | null
  restaurantNom: string | null
  setRestaurant: (id: string, nom: string) => void
}

export const useRestaurantStore = create<RestaurantStore>()(
  persist(
    (set) => ({
      restaurantId: null,
      restaurantNom: null,
      setRestaurant: (id, nom) => set({ restaurantId: id, restaurantNom: nom })
    }),
    { name: 'restaurant-store' }
  )
)
```

---

## 7. Caméra iOS Safari PWA

### Approche recommandée MVP — input[capture]

```tsx
// components/DishCamera.tsx
'use client'
import { useRef, useState } from 'react'

export function DishCamera({ onCapture }: { onCapture: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Preview immédiat
    setPreview(URL.createObjectURL(file))
    
    // Compression si > 2MB (éviter lenteur upload + coût Gemini)
    if (file.size > 2 * 1024 * 1024) {
      compressImage(file).then(onCapture)
    } else {
      onCapture(file)
    }
  }

  return (
    <div>
      {/* input[capture] = ouvre caméra native iOS/Android directement */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"  // caméra arrière
        onChange={handleCapture}
        className="hidden"
      />
      {preview
        ? <img src={preview} className="w-full rounded-xl" onClick={() => inputRef.current?.click()} />
        : <button onClick={() => inputRef.current?.click()} className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center">
            📸 Photographier le plat
          </button>
      }
    </div>
  )
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.onload = () => {
      const MAX = 1080
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = (height / width) * MAX; width = MAX }
        else { width = (width / height) * MAX; height = MAX }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}
```

---

## 8. Tailwind CSS v4 — Mobile-first Design Tokens

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Couleurs principales */
  --color-primary: #1a1a2e;
  --color-primary-light: #16213e;
  --color-accent: #e94560;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;

  /* Safe area iPhone */
  --spacing-safe-bottom: env(safe-area-inset-bottom);
  --spacing-safe-top: env(safe-area-inset-top);

  /* Typography mobile-first */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
}

/* Hauteur plein écran iOS (évite barre du bas) */
.h-screen-safe {
  height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
```

---

## 9. Supabase Realtime — Dashboard live

```typescript
// hooks/useDashboardRealtime.ts
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trpc } from '@/lib/trpc/client'

export function useDashboardRealtime(restaurantId: string) {
  const utils = trpc.useUtils()
  
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel(`dashboard:${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventes',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        // Invalider le cache tRPC → refetch automatique
        utils.dashboard.get.invalidate()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'plats',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        utils.plats.list.invalidate()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, utils])
}
```

---

## Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```
