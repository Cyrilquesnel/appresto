# Task 6.1: Onboarding Progressif 3 Jours

## Objective
Flow d'onboarding selon D28 DISCOVERY.md — Jour 1 (< 2 min : type établissement + photo plat), Jour 2 (notification prix), Jour 3 (notification commande).

## Context
L'onboarding doit être complété en < 2 minutes le premier jour. Il ne doit pas être bloquant — l'app fonctionne normalement pendant et après. Les notifications J2/J3 incitent à découvrir les autres modules.

## Dependencies
- Task 2.1 — pipeline photo opérationnel
- Task 4.1 — dashboard accessible

## Blocked By
- Tasks 2.1 + 4.1

## Implementation Plan

### Step 1: Router tRPC — onboarding

```typescript
// server/routers/dashboard.ts — ajouter

getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
  const { data: restaurant } = await ctx.supabase
    .from('restaurants')
    .select('parametres, created_at')
    .eq('id', ctx.restaurantId)
    .single()

  const parametres = (restaurant?.parametres as any) ?? {}
  const onboardingCompletedAt = parametres.onboarding_completed_at
  
  // Calculer les jours depuis création
  const createdAt = new Date(restaurant?.created_at ?? Date.now())
  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  const { count: platsCount } = await ctx.supabase
    .from('plats')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', ctx.restaurantId)

  const { count: mercurialeCount } = await ctx.supabase
    .from('mercuriale')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', ctx.restaurantId)
    .eq('est_actif', true)

  const { count: bonsCount } = await ctx.supabase
    .from('bons_de_commande')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', ctx.restaurantId)

  return {
    completed: !!onboardingCompletedAt,
    completed_at: onboardingCompletedAt,
    days_since_creation: daysSinceCreation,
    steps: {
      type_etablissement: !!parametres.type_etablissement,
      premier_plat: (platsCount ?? 0) > 0,
      premiers_prix: (mercurialeCount ?? 0) > 0,
      premiere_commande: (bonsCount ?? 0) > 0,
    },
  }
}),

completeOnboarding: protectedProcedure
  .input(z.object({
    type_etablissement: z.enum(['restaurant', 'brasserie', 'gastronomique', 'snack', 'traiteur', 'autre']),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data: restaurant } = await ctx.supabase
      .from('restaurants')
      .select('parametres')
      .eq('id', ctx.restaurantId)
      .single()

    await ctx.supabase
      .from('restaurants')
      .update({
        parametres: {
          ...(restaurant?.parametres as any ?? {}),
          type_etablissement: input.type_etablissement,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .eq('id', ctx.restaurantId)

    return { success: true }
  }),
```

### Step 2: Pages d'onboarding

```typescript
// app/(app)/onboarding/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const TYPES_ETABLISSEMENT = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽' },
  { value: 'brasserie', label: 'Brasserie', emoji: '🍺' },
  { value: 'gastronomique', label: 'Gastronomique', emoji: '⭐' },
  { value: 'snack', label: 'Snack / Fastfood', emoji: '🍔' },
  { value: 'traiteur', label: 'Traiteur', emoji: '🥘' },
  { value: 'autre', label: 'Autre', emoji: '🍴' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string>('')
  const complete = trpc.dashboard.completeOnboarding.useMutation({
    onSuccess: () => router.push('/onboarding/plat'),
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 flex flex-col justify-center px-6 py-12" data-testid="onboarding-step-1">
      <div className="text-white mb-8">
        <h1 className="text-3xl font-bold mb-2">Bienvenue sur Mise en Place 👋</h1>
        <p className="text-lg opacity-80">Configurez votre restaurant en 2 minutes</p>
        <div className="flex gap-1 mt-4">
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Quel type d'établissement ?</h2>
        <div className="grid grid-cols-2 gap-3">
          {TYPES_ETABLISSEMENT.map(type => (
            <button
              key={type.value}
              onClick={() => setSelected(type.value)}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                selected === type.value
                  ? 'border-accent bg-accent/5'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
              data-testid={`type-${type.value}`}
            >
              <span className="text-3xl">{type.emoji}</span>
              <span className="text-sm font-medium text-gray-700">{type.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => complete.mutate({ type_etablissement: selected as any })}
          disabled={!selected || complete.isPending}
          className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50 mt-4"
          data-testid="continue-onboarding"
        >
          {complete.isPending ? 'Enregistrement...' : 'Continuer →'}
        </button>
      </div>
    </div>
  )
}
```

```typescript
// app/(app)/onboarding/plat/page.tsx
// Étape 2: prendre une photo d'un premier plat
// Utilise DishCamera + lien vers /plats/nouveau avec paramètre from=onboarding
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function OnboardingPlatPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 flex flex-col justify-center px-6 py-12" data-testid="onboarding-step-2">
      <div className="text-white mb-8">
        <h1 className="text-2xl font-bold mb-2">Ajoutez votre premier plat 📸</h1>
        <p className="opacity-80">Photographiez un plat — l'IA analyse automatiquement les ingrédients</p>
        <div className="flex gap-1 mt-4">
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-4">
        <Link
          href="/plats/nouveau?from=onboarding"
          className="w-full py-6 bg-accent text-white font-semibold rounded-2xl flex items-center justify-center gap-3 text-lg"
          data-testid="take-photo-cta"
        >
          <span className="text-3xl">📸</span>
          <span>Photographier un plat</span>
        </Link>

        <button
          onClick={() => router.push('/onboarding/done')}
          className="w-full py-3 text-gray-400 text-sm hover:text-gray-600"
          data-testid="skip-photo"
        >
          Passer cette étape pour l'instant
        </button>
      </div>
    </div>
  )
}
```

```typescript
// app/(app)/onboarding/done/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OnboardingDonePage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push('/dashboard'), 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-success to-success/80 flex flex-col items-center justify-center px-6" data-testid="onboarding-done">
      <div className="text-center text-white">
        <div className="text-8xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-3">C'est parti !</h1>
        <p className="text-lg opacity-80 mb-8">Votre restaurant est configuré</p>
        <p className="text-sm opacity-60">Redirection vers le tableau de bord...</p>
      </div>
    </div>
  )
}
```

### Step 3: Cron notifications onboarding

```typescript
// app/api/cron/onboarding-notifications/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const today = new Date()

  // Trouver les restaurants créés il y a exactement J+1 et J+2
  const j1 = new Date(today)
  j1.setDate(j1.getDate() - 1)
  const j2 = new Date(today)
  j2.setDate(j2.getDate() - 2)

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, nom, email_contact, parametres')
    .gte('created_at', j1.toISOString().split('T')[0])
    .lte('created_at', j2.toISOString().split('T')[0] + 'T23:59:59Z')

  let notified = 0
  for (const restaurant of (restaurants ?? [])) {
    const createdAt = new Date(restaurant.created_at ?? Date.now())
    const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    if (days === 1) {
      // Notification J+1: "Ajoutez vos prix"
      console.log(`[onboarding] J+1 notification pour ${restaurant.id}`)
      notified++
    } else if (days === 2) {
      // Notification J+2: "Générez votre premier bon de commande"
      console.log(`[onboarding] J+2 notification pour ${restaurant.id}`)
      notified++
    }
  }

  return Response.json({ notified })
}
```

### Step 4: Composant OnboardingProgress

```typescript
// components/onboarding/OnboardingProgress.tsx
// Affiché sur le dashboard si onboarding non complété
'use client'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

export function OnboardingProgress() {
  const { data } = trpc.dashboard.getOnboardingStatus.useQuery()

  if (!data || data.completed) return null

  const steps = [
    { key: 'type_etablissement', label: 'Type d\'établissement', done: data.steps.type_etablissement, href: '/onboarding' },
    { key: 'premier_plat', label: 'Premier plat', done: data.steps.premier_plat, href: '/plats/nouveau' },
    { key: 'premiers_prix', label: 'Prix en mercuriale', done: data.steps.premiers_prix, href: '/mercuriale' },
    { key: 'premiere_commande', label: 'Première commande', done: data.steps.premiere_commande, href: '/commandes/nouveau' },
  ]

  const completedCount = steps.filter(s => s.done).length

  return (
    <div className="bg-accent/5 rounded-2xl p-4 border border-accent/20 mb-4" data-testid="onboarding-progress">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-primary">Démarrage ({completedCount}/{steps.length})</h3>
        <span className="text-xs text-gray-400">{Math.round(completedCount / steps.length * 100)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${completedCount / steps.length * 100}%` }} />
      </div>
      <div className="space-y-2">
        {steps.map(step => (
          <div key={step.key} className="flex items-center gap-2">
            <span className={step.done ? 'text-success' : 'text-gray-300'}>{step.done ? '✓' : '○'}</span>
            {step.done ? (
              <span className="text-sm text-gray-500 line-through">{step.label}</span>
            ) : (
              <Link href={step.href} className="text-sm text-accent hover:underline">{step.label} →</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 5: Tests

```typescript
// tests/e2e/onboarding-complete.spec.ts
import { test, expect } from '@playwright/test'

test('onboarding J1 complet en < 2 minutes', async ({ page }) => {
  const startTime = Date.now()

  await page.goto('/onboarding')
  await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible()

  // Sélectionner type restaurant
  await page.click('[data-testid="type-restaurant"]')
  await page.click('[data-testid="continue-onboarding"]')

  // Passer la photo
  await page.click('[data-testid="skip-photo"]')

  // Vérifier done screen
  await expect(page.locator('[data-testid="onboarding-done"]')).toBeVisible({ timeout: 5000 })

  // Vérifier redirection vers dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 5000 })

  const elapsed = Date.now() - startTime
  expect(elapsed).toBeLessThan(120000) // < 2 minutes
})
```

## Files to Create

- `app/(app)/onboarding/page.tsx`
- `app/(app)/onboarding/plat/page.tsx`
- `app/(app)/onboarding/done/page.tsx`
- `app/api/cron/onboarding-notifications/route.ts`
- `components/onboarding/OnboardingProgress.tsx`
- `tests/e2e/onboarding-complete.spec.ts`

## Files to Modify

- `server/routers/dashboard.ts` — ajouter getOnboardingStatus, completeOnboarding
- `app/(app)/dashboard/page.tsx` — intégrer OnboardingProgress
- `vercel.json` — cron onboarding-notifications déjà dans 5.5

## Acceptance Criteria

- [ ] Onboarding J1 complet en < 2 minutes (Playwright timer)
- [ ] Après onboarding → redirect dashboard (non bloquant)
- [ ] Cron onboarding J2/J3 → status 200
- [ ] OnboardingProgress visible sur dashboard si non complété
- [ ] Utilisateur sans photo → accès onboarding depuis dashboard

## Testing Protocol

### Playwright
```bash
npx playwright test tests/e2e/onboarding-complete.spec.ts --project="iPhone 14 Safari"
```

### curl cron
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/onboarding-notifications
```

## Git

- Branch: `phase-6/finitions`
- Commit message prefix: `Task 6.1:`

## PROGRESS.md Update

Marquer Task 6.1 ✅ dans PROGRESS.md.
