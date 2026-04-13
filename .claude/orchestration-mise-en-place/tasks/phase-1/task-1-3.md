# Task 1.3: Auth — Supabase Auth + Middleware Next.js

## Objective
Implémenter l'authentification complète : pages login/register, middleware de protection des routes `/(app)/*`, et création automatique du restaurant + restaurant_users à l'inscription.

## Context
Sans auth, rien ne fonctionne. Le middleware protège toutes les routes app. À l'inscription, un restaurant est créé automatiquement et l'utilisateur est assigné comme owner — c'est le fondement du système multi-tenant.

## Dependencies
- Task 1.2 — tables `restaurants` et `restaurant_users` créées, RLS active

## Blocked By
- Task 1.2

## Implementation Plan

### Step 1: Middleware de protection des routes

```typescript
// middleware.ts (à la racine du projet)
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Routes publiques
  const publicRoutes = ['/login', '/register', '/api/health']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
```

### Step 2: Layout auth (pages login/register)

```tsx
// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--color-primary)' }}>
          Mise en Place
        </h1>
        {children}
      </div>
    </div>
  )
}
```

### Step 3: Page de login

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2"
          placeholder="chef@restaurant.fr"
          name="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2"
          placeholder="••••••••"
          name="password"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
      <p className="text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium" style={{ color: 'var(--color-accent)' }}>
          Créer un compte
        </Link>
      </p>
    </form>
  )
}
```

### Step 4: Page de register

```tsx
// app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurantNom, setRestaurantNom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Créer le restaurant
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert({ nom: restaurantNom, owner_id: data.user.id })
        .select('id')
        .single()

      if (restError || !restaurant) {
        setError('Erreur lors de la création du restaurant')
        setLoading(false)
        return
      }

      // Créer l'association restaurant_users
      await supabase.from('restaurant_users').insert({
        restaurant_id: restaurant.id,
        user_id: data.user.id,
        role: 'owner'
      })

      router.push('/onboarding')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de votre restaurant</label>
        <input
          type="text"
          value={restaurantNom}
          onChange={e => setRestaurantNom(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Le Bistrot du Coin"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="chef@restaurant.fr"
          name="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Minimum 8 caractères"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? 'Création...' : 'Créer mon compte'}
      </button>
      <p className="text-center text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--color-accent)' }}>
          Se connecter
        </Link>
      </p>
    </form>
  )
}
```

### Step 5: Layout app protégé avec navigation mobile

```tsx
// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14">
          <a href="/dashboard" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">📊</span>
            <span>Tableau</span>
          </a>
          <a href="/plats" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">🍽</span>
            <span>Plats</span>
          </a>
          <a href="/commandes" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">📦</span>
            <span>Commandes</span>
          </a>
          <a href="/pms" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">🌡</span>
            <span>PMS</span>
          </a>
        </div>
      </nav>
    </div>
  )
}
```

### Step 6: Page dashboard placeholder

```tsx
// app/(app)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurantUser } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, restaurants(nom)')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">
        {(restaurantUser?.restaurants as any)?.nom ?? 'Mon Restaurant'}
      </h1>
      <p className="text-gray-500 mt-2">Tableau de bord — en construction</p>
    </div>
  )
}
```

### Step 7: Page onboarding placeholder

```tsx
// app/(app)/onboarding/page.tsx
export default function OnboardingPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Bienvenue !</h1>
      <p className="text-gray-500 mt-2">Onboarding — en construction (Task 6.1)</p>
    </div>
  )
}
```

### Step 8: Action de logout

```tsx
// app/(app)/settings/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Paramètres</h1>
      <button
        onClick={handleLogout}
        className="mt-6 w-full py-3 rounded-lg border border-red-300 text-red-600 font-medium"
      >
        Se déconnecter
      </button>
    </div>
  )
}
```

### Step 9: Configurer Supabase Auth (email confirmation désactivée pour dev)

Dans Supabase Studio local (http://localhost:54323) :
- Authentication → Settings → "Enable email confirmations" → OFF (pour dev local)

Ou via `supabase/config.toml` :
```toml
[auth]
enabled = true
# Désactiver confirmation email en dev
[auth.email]
enable_signup = true
double_confirm_changes = false
enable_confirmations = false
```

## Files to Create

- `middleware.ts`
- `app/(auth)/layout.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/onboarding/page.tsx`
- `app/(app)/settings/page.tsx`

## Contracts

### Provides (pour tâches suivantes)
- `createClient()` server/client importable depuis `@/lib/supabase/server` et `@/lib/supabase/client`
- Session utilisateur disponible dans tous les Server Components via `supabase.auth.getUser()`
- `restaurant_users.restaurant_id` accessible pour toutes les queries RLS
- Redirect automatique vers `/login` si non authentifié

### Consumes (de Task 1.2)
- Tables `restaurants` et `restaurant_users`
- Clients Supabase `lib/supabase/server.ts` et `lib/supabase/client.ts`

## Acceptance Criteria

- [ ] Un utilisateur peut s'inscrire avec email + password + nom restaurant
- [ ] À l'inscription : `restaurants` + `restaurant_users` créés automatiquement
- [ ] Après inscription → redirect vers `/onboarding`
- [ ] Un utilisateur peut se connecter → redirect vers `/dashboard`
- [ ] Accès direct `/dashboard` sans session → redirect `/login`
- [ ] Accès `/login` avec session active → redirect `/dashboard`
- [ ] Logout → session détruite → redirect `/login`
- [ ] Navigation mobile visible en bas de l'écran dans les pages `/(app)/*`

## Testing Protocol

### Browser Testing (Playwright MCP)
- `npm run dev`
- Flow 1: http://localhost:3000/register → remplir form → submit → vérifier redirect /onboarding
- Flow 2: http://localhost:3000/login → remplir → submit → vérifier redirect /dashboard
- Flow 3: Accéder http://localhost:3000/dashboard sans session → vérifier redirect /login
- Flow 4: Depuis /settings → logout → vérifier redirect /login
- Vérifier Supabase Studio: `restaurants` + `restaurant_users` créés après register

### Unit Tests
```typescript
// tests/unit/middleware.test.ts
// Tester que le middleware redirige correctement
// (mock supabase.auth.getUser)
```

## Skills to Read

- `supabase-rls-multitenant` — patterns auth, restaurant_users
- `nextjs-pwa-mobile` — middleware Next.js SSR

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.3:`

## PROGRESS.md Update

Marquer Task 1.3 ✅ dans PROGRESS.md.
