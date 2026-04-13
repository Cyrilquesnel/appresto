# Task 1.4: tRPC Setup — Context, Routers, Client

## Objective
Configurer tRPC v11 complet : contexte Supabase avec `restaurantId`, tous les routers (stubs vides), client React Query, et store Zustand pour le restaurantId. C'est la couche API type-safe du projet.

## Context
tRPC remplace les API routes classiques pour toutes les mutations et queries. Le contexte injecte automatiquement `user`, `supabase`, et `restaurantId` dans chaque procédure protégée.

## Dependencies
- Task 1.3 — auth fonctionnelle, clients Supabase créés

## Blocked By
- Task 1.3

## Implementation Plan

### Step 1: Installer superjson (transformateur tRPC)

```bash
npm install superjson
```

### Step 2: Contexte tRPC + Procédures

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const createTRPCContext = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let restaurantId: string | null = null
  let role: string | null = null

  if (user) {
    const { data: restaurantUser } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, role')
      .eq('user_id', user.id)
      .single()

    restaurantId = restaurantUser?.restaurant_id ?? null
    role = restaurantUser?.role ?? null
  }

  return { user, supabase, restaurantId, role }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.restaurantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      restaurantId: ctx.restaurantId,
    },
  })
})
```

### Step 3: Routers (stubs — seront remplis dans les phases suivantes)

```typescript
// server/routers/plats.ts
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const platsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('plats')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
    return data ?? []
  }),

  searchIngredients: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .rpc('search_ingredients', {
          p_query: input.query,
          p_restaurant_id: ctx.restaurantId,
          p_limit: input.limit,
        })
      return data ?? []
    }),
})
```

```typescript
// server/routers/fiches.ts
import { router, protectedProcedure } from '../trpc'

export const fichesRouter = router({
  // Sera rempli en Task 2.3
})
```

```typescript
// server/routers/commandes.ts
import { router, protectedProcedure } from '../trpc'

export const commandesRouter = router({
  // Sera rempli en Tasks 3.1–3.4
})
```

```typescript
// server/routers/dashboard.ts
import { router, protectedProcedure } from '../trpc'

export const dashboardRouter = router({
  // Sera rempli en Task 4.2
})
```

```typescript
// server/routers/pms.ts
import { router, protectedProcedure } from '../trpc'

export const pmsRouter = router({
  // Sera rempli en Tasks 5.1–5.6
})
```

```typescript
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
```

### Step 4: Route handler tRPC (App Router)

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError: ({ path, error }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`tRPC error on ${path}:`, error)
      }
    },
  })

export { handler as GET, handler as POST }
```

### Step 5: Client tRPC React

```typescript
// lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers'

export const trpc = createTRPCReact<AppRouter>()
```

### Step 6: Providers (QueryClient + tRPC + Zustand)

```typescript
// stores/restaurant.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RestaurantStore {
  restaurantId: string | null
  restaurantNom: string | null
  setRestaurant: (id: string, nom: string) => void
  clearRestaurant: () => void
}

export const useRestaurantStore = create<RestaurantStore>()(
  persist(
    (set) => ({
      restaurantId: null,
      restaurantNom: null,
      setRestaurant: (id, nom) => set({ restaurantId: id, restaurantNom: nom }),
      clearRestaurant: () => set({ restaurantId: null, restaurantNom: null }),
    }),
    { name: 'restaurant-store' }
  )
)
```

```tsx
// providers.tsx
'use client'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import { trpc } from '@/lib/trpc/client'
import { useRestaurantStore } from '@/stores/restaurant'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000, retry: 2 },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
          headers() {
            const restaurantId = useRestaurantStore.getState().restaurantId
            return restaurantId ? { 'x-restaurant-id': restaurantId } : {}
          },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

### Step 7: Mettre à jour app/layout.tsx pour inclure Providers

```tsx
// app/layout.tsx — ajouter Providers
import { Providers } from '@/providers'

// Dans le body :
<body className="antialiased">
  <Providers>{children}</Providers>
</body>
```

### Step 8: Test de smoke tRPC

Créer un test unitaire pour vérifier la config :

```typescript
// tests/unit/trpc.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } })
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null })
  })
}))

describe('tRPC context', () => {
  it('creates context with null user when unauthenticated', async () => {
    const { createTRPCContext } = await import('@/server/trpc')
    const ctx = await createTRPCContext()
    expect(ctx.user).toBeNull()
    expect(ctx.restaurantId).toBeNull()
  })
})
```

## Files to Create

- `server/trpc.ts`
- `server/routers/index.ts`
- `server/routers/plats.ts`
- `server/routers/fiches.ts`
- `server/routers/commandes.ts`
- `server/routers/dashboard.ts`
- `server/routers/pms.ts`
- `app/api/trpc/[trpc]/route.ts`
- `lib/trpc/client.ts`
- `providers.tsx`
- `stores/restaurant.ts`
- `tests/unit/trpc.test.ts`

## Files to Modify

- `app/layout.tsx` — ajouter `<Providers>`

## Contracts

### Provides (pour tâches suivantes)
- `protectedProcedure` — procédure tRPC avec user + restaurantId garantis
- `trpc.<router>.<procedure>` — client React typé
- `useRestaurantStore` — restaurantId persisté dans localStorage
- `GET/POST /api/trpc/*` — endpoint tRPC fonctionnel

### Consumes (de Task 1.3)
- `createClient()` depuis `@/lib/supabase/server`
- Session auth Supabase

## Acceptance Criteria

- [ ] `curl http://localhost:3000/api/trpc/plats.list` retourne une réponse tRPC JSON valide
- [ ] Sans auth → `{ error: { code: 'UNAUTHORIZED' } }`
- [ ] `npm run typecheck` passe — AppRouter types inférés correctement
- [ ] `npm run test:unit` → test tRPC context passe
- [ ] `useRestaurantStore` persisté après rechargement (vérifier localStorage)

## Testing Protocol

### Unit Tests
- `npm run test:unit` → tests/unit/trpc.test.ts passe

### API Testing
```bash
# Sans auth
curl http://localhost:3000/api/trpc/plats.list
# Attendu : {"error":{"code":"UNAUTHORIZED",...}}
```

### Type Check
- `npm run typecheck` → 0 erreur

## Skills to Read

- `mise-en-place-architecture` — structure routers, conventions tRPC

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.4:`

## PROGRESS.md Update

Marquer Task 1.4 ✅ dans PROGRESS.md.
