# Task 7.2: Sentry + PostHog

## Objective
Monitoring erreurs (Sentry) + analytics RGPD-friendly (PostHog EU) opérationnels en production. `tracesSampleRate: 0.1`, `maskAllText: true` pour Sentry replay. PostHog host EU.

## Context
Sentry capture les erreurs runtime. PostHog EU (eu.i.posthog.com) pour analytics RGPD. Events clés trackés: `dish_photo_analyzed`, `fiche_technique_saved`, `bon_commande_generated`, `temperature_logged`, `ddpp_export_generated`.

## Dependencies
- Task 7.1 — CI/CD pipeline opérationnel

## Blocked By
- Task 7.1

## Implementation Plan

### Step 1: Installation

```bash
npm install @sentry/nextjs posthog-js posthog-node
npx @sentry/wizard@latest -i nextjs
```

### Step 2: sentry.client.config.ts

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,       // Masquer données sensibles
      blockAllMedia: false,
      maskAllInputs: true,
    }),
  ],
  // Ne pas capturer les erreurs réseau normales
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error$/,
    /^Request failed with status code 4\d\d$/,
  ],
})
```

### Step 3: sentry.server.config.ts

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  debug: false,
})
```

### Step 4: lib/posthog.ts

```typescript
// lib/posthog.ts
import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://eu.i.posthog.com', // EU RGPD
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,  // Contrôle manuel pour RGPD
    disable_session_recording: process.env.NODE_ENV !== 'production',
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.opt_out_capturing()
    },
  })
}

export type PostHogEvent =
  | 'dish_photo_analyzed'
  | 'fiche_technique_saved'
  | 'bon_commande_generated'
  | 'temperature_logged'
  | 'ddpp_export_generated'
  | 'onboarding_completed'
  | 'push_notification_subscribed'
  | 'rappel_alert_received'

export function trackEvent(event: PostHogEvent, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, {
    ...properties,
    // Ne jamais inclure de PII
    $ip: '0.0.0.0', // Masquer l'IP
  })
}

export function identifyRestaurant(restaurantId: string) {
  if (typeof window === 'undefined') return
  // Identifier par restaurant_id (pas par user email)
  posthog.identify(restaurantId)
}
```

### Step 5: components/PostHogProvider.tsx

```typescript
// components/PostHogProvider.tsx
'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog } from '@/lib/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    // Capturer les changements de page manuellement
    if (typeof window !== 'undefined') {
      const { posthog } = require('posthog-js')
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

### Step 6: Intégration dans les mutations tRPC

```typescript
// Exemple dans un composant utilisant trackEvent:
// components/dishes/FicheTechniqueForm.tsx
import { trackEvent } from '@/lib/posthog'

// Dans onSuccess du mutation:
const createFiche = trpc.fiches.create.useMutation({
  onSuccess: () => {
    trackEvent('fiche_technique_saved', {
      avec_photo: !!photoUrl,
      nb_ingredients: ingredients.length,
    })
  },
})

// Dans analyze-dish route:
// Après analyse Gemini réussie:
// (côté serveur — PostHog Node.js SDK)
import { PostHog } from 'posthog-node'
const phNode = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  host: 'https://eu.i.posthog.com',
})
phNode.capture({
  distinctId: restaurantId,
  event: 'dish_photo_analyzed',
  properties: {
    nb_ingredients_detected: ingredients.length,
    confidence_average: avgConfidence,
  },
})
await phNode.shutdown()
```

### Step 7: next.config.ts — withSentryConfig

```typescript
// next.config.ts — envelopper avec withSentryConfig
import { withSentryConfig } from '@sentry/nextjs'
import withPWA from '@ducanh2912/next-pwa'

const nextConfig = withPWA({ /* ... */ })({ /* ... */ })

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: '/monitoring', // Évite les bloqueurs de pub
  hideSourceMaps: true,
  disableLogger: true,
})
```

### Step 8: Tests

```typescript
// tests/unit/posthog.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

import posthog from 'posthog-js'
import { trackEvent } from '@/lib/posthog'

describe('posthog trackEvent', () => {
  it('capture appelé avec le bon event', () => {
    trackEvent('fiche_technique_saved', { nb_ingredients: 5 })
    expect(posthog.capture).toHaveBeenCalledWith(
      'fiche_technique_saved',
      expect.objectContaining({ nb_ingredients: 5 })
    )
  })

  it('ne capture pas de PII (email, etc)', () => {
    trackEvent('dish_photo_analyzed')
    const call = (posthog.capture as any).mock.calls.at(-1)
    const properties = call[1]
    expect(properties.email).toBeUndefined()
    expect(properties.nom).toBeUndefined()
  })
})
```

## Files to Create

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `lib/posthog.ts`
- `components/PostHogProvider.tsx`
- `tests/unit/posthog.test.ts`

## Files to Modify

- `next.config.ts` — withSentryConfig
- `app/layout.tsx` — PostHogProvider wrapper
- `app/api/analyze-dish/route.ts` — trackEvent dish_photo_analyzed
- `server/routers/fiches.ts` — trackEvent fiche_technique_saved (via onSuccess ou côté route)
- `app/api/cron/rappelconso/route.ts` — trackEvent rappel_alert_received

## Variables d'Environnement

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
SENTRY_AUTH_TOKEN=sntrys_xxxx
SENTRY_ORG=la-fabrique-alimentaire
SENTRY_PROJECT=mise-en-place
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxx
```

## Acceptance Criteria

- [ ] Déclencher une erreur test → apparaît dans Sentry dashboard < 30s
- [ ] Event PostHog visible dans dashboard EU PostHog
- [ ] Aucune donnée PII dans les payloads PostHog (vérifiable en debug)
- [ ] `tracesSampleRate: 0.1` configuré
- [ ] Sentry replay avec `maskAllText: true`
- [ ] Source maps uploadées → stack traces lisibles dans Sentry

## Testing Protocol

### Déclencher erreur test Sentry
```bash
# Ajouter temporairement dans une route:
throw new Error('Sentry test error — CI validation')
# Vérifier dans Sentry dashboard < 30s
```

### Vérifier PostHog
```bash
# Mode debug dans la console navigateur:
# posthog.debug()
# Puis effectuer une action (créer fiche) → voir l'event dans la console
```

### Vitest
```bash
npm run test:unit -- posthog
```

## Git

- Branch: `phase-7/cicd`
- Commit message prefix: `Task 7.2:`

## PROGRESS.md Update

Marquer Task 7.2 ✅ dans PROGRESS.md.
