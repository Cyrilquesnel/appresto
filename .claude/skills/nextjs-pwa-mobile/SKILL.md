---
name: nextjs-pwa-mobile
description: Next.js 14 App Router + PWA mobile-first pour Mise en Place. Utilise quand tu crées des pages, composants, hooks, ou configures la PWA.
---

# Next.js 14 PWA Mobile-first

## Conventions App Router
- Server Components par défaut (data fetching, dashboard lourd)
- `'use client'` uniquement pour interactivité (formulaires, camera, réaltime)
- Layouts imbriqués : `/(auth)/layout.tsx` et `/(app)/layout.tsx`

## Caméra iOS Safari — règle absolue
**Toujours utiliser `input[type=file][capture=environment]`** pour la capture photo.
NE PAS utiliser `getUserMedia()` en MVP (PWA iOS instable).
```tsx
<input type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
```

## Safe area iPhone
```css
/* Toujours appliquer sur les éléments fixed en bas */
padding-bottom: env(safe-area-inset-bottom);
height: calc(100dvh - env(safe-area-inset-top));
```

## Push notifications iOS
- Fonctionne UNIQUEMENT si la PWA est installée (iOS 16.4+)
- Afficher `IOSInstallPrompt` aux utilisateurs iOS non-installés
- Fallback email obligatoire pour les alertes PMS critiques

## Background Sync PMS
Les routes `/api/trpc/pms.saveTemperatureLog` et `pms.saveChecklistCompletion` sont interceptées par le Service Worker si offline.
La queue est flushée automatiquement au retour du réseau.

## Compression image avant upload
Toujours compresser les photos > 2MB avant envoi à Gemini.
Utiliser la fonction `compressImage()` dans `components/dishes/DishCamera.tsx`.

## tRPC dans les composants
```typescript
// Server Component
const data = await trpc.dashboard.get.query()  // via server caller

// Client Component
const { data } = trpc.plats.list.useQuery()
const mutation = trpc.plats.create.useMutation()
```

## Tailwind v4 — design tokens
Couleurs et tokens définis dans `app/globals.css` via `@theme {}`.
Ne pas utiliser `tailwind.config.js` pour les tokens (v4 = CSS natif).

## Références
- Config complète PWA + SW : research/next-js-pwa-supabase.md
- tRPC setup : research/next-js-pwa-supabase.md section 5
