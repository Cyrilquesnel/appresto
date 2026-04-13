# Task 6.3: Push Notifications VAPID

## Objective
Notifications push Web (VAPID) pour reminders PMS et alertes rappel produit. Fallback email Resend si iOS non installé ou pas de subscription.

## Context
VAPID keys générées via `web-push generate-vapid-keys`. Table `push_subscriptions` stocke les subscriptions JSON. Notification contient un `data.url` pour rediriger au clic. iOS supporté uniquement si PWA installée.

## Dependencies
- Task 6.2 — PWA manifest installable
- Task 5.5 — RappelConso cron opérationnel

## Blocked By
- Tasks 6.2 + 5.5

## Implementation Plan

### Step 1: Générer les clés VAPID

```bash
# Installer web-push
npm install web-push
npx web-push generate-vapid-keys
# Copier VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY dans .env.local
```

### Step 2: lib/push-notifications.ts

```typescript
// lib/push-notifications.ts
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:contact@miseenplace.fr',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: {
    url: string
    type?: string
  }
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<void> {
  await webpush.sendNotification(
    subscription,
    JSON.stringify(payload),
    {
      urgency: 'normal',
      TTL: 86400, // 24h
    }
  )
}

export async function sendPMSReminder(subscription: webpush.PushSubscription): Promise<void> {
  await sendPushNotification(subscription, {
    title: 'Mise en Place — PMS',
    body: 'N\'oubliez pas de relever vos températures',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/pms/temperatures', type: 'pms-reminder' },
  })
}

export async function sendRappelAlert(
  subscription: webpush.PushSubscription,
  produit: string,
  ingredient: string
): Promise<void> {
  await sendPushNotification(subscription, {
    title: '⚠️ Alerte rappel produit',
    body: `${produit} (${ingredient}) est concerné par un rappel`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/pms/rappels', type: 'rappel-alert' },
  })
}

export async function sendOnboardingNotification(
  subscription: webpush.PushSubscription,
  type: 'j2' | 'j3'
): Promise<void> {
  const messages = {
    j2: {
      body: 'Ajoutez vos prix pour calculer votre food cost automatiquement',
      url: '/mercuriale',
    },
    j3: {
      body: 'Générez votre premier bon de commande en 2 minutes',
      url: '/commandes/nouveau',
    },
  }
  await sendPushNotification(subscription, {
    title: 'Mise en Place',
    body: messages[type].body,
    icon: '/icons/icon-192.png',
    data: { url: messages[type].url, type: `onboarding-${type}` },
  })
}
```

### Step 3: Migration SQL — table push_subscriptions

```sql
-- supabase/migrations/XXXX_push_subscriptions.sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un seul abonnement par user
CREATE UNIQUE INDEX push_subscriptions_user_idx ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
```

### Step 4: app/api/push/subscribe/route.ts

```typescript
// app/api/push/subscribe/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!restaurant) return Response.json({ error: 'Restaurant not found' }, { status: 404 })

  const subscription = await req.json()

  // Valider le format de la subscription
  if (!subscription?.endpoint || !subscription?.keys?.auth || !subscription?.keys?.p256dh) {
    return Response.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      restaurant_id: restaurant.id,
      subscription,
      user_agent: req.headers.get('user-agent') ?? '',
    }, {
      onConflict: 'user_id',
    })

  return Response.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)

  return Response.json({ success: true })
}
```

### Step 5: composant PushPermissionPrompt

```typescript
// components/pms/PushPermissionPrompt.tsx
'use client'
import { useState, useEffect } from 'react'

export function PushPermissionPrompt() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus('unsupported')
    } else {
      setStatus(Notification.permission)
    }
  }, [])

  const subscribe = async () => {
    const permission = await Notification.requestPermission()
    setStatus(permission)

    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (status === 'granted' || status === 'unsupported') return null

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4" data-testid="push-permission-prompt">
      <p className="text-sm font-medium text-primary mb-3">
        🔔 Activez les notifications pour recevoir les alertes PMS et rappels produits
      </p>
      <button
        onClick={subscribe}
        className="w-full py-2 bg-accent text-white text-sm font-semibold rounded-xl"
        data-testid="enable-push"
      >
        Activer les notifications
      </button>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
```

### Step 6: Service Worker — handleNotificationClick dans sw-custom.js

```javascript
// public/sw-custom.js — ajouter
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Trouver un onglet ouvert
        const existing = clients.find(c => c.url.includes(self.registration.scope))
        if (existing) {
          existing.focus()
          existing.postMessage({ type: 'NAVIGATE', url })
        } else {
          self.clients.openWindow(url)
        }
      })
  )
})
```

### Step 7: Tests

```typescript
// tests/unit/push-notifications.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}))

import webpush from 'web-push'
import { sendPMSReminder } from '@/lib/push-notifications'

const mockSubscription = {
  endpoint: 'https://fcm.googleapis.com/test',
  keys: { auth: 'test-auth', p256dh: 'test-p256dh' },
} as any

describe('push-notifications', () => {
  it('sendPMSReminder appelle sendNotification avec le bon payload', async () => {
    await sendPMSReminder(mockSubscription)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      mockSubscription,
      expect.stringContaining('températures'),
      expect.any(Object)
    )
  })

  it('sendRappelAlert inclut le nom du produit dans le body', async () => {
    await sendRappelAlert(mockSubscription, 'Brie de Meaux', 'fromage')

    const call = (webpush.sendNotification as any).mock.calls.at(-1)
    const payload = JSON.parse(call[1])
    expect(payload.body).toContain('Brie de Meaux')
    expect(payload.data.url).toBe('/pms/rappels')
  })
})
```

## Files to Create

- `lib/push-notifications.ts`
- `app/api/push/subscribe/route.ts`
- `components/pms/PushPermissionPrompt.tsx`
- `supabase/migrations/XXXX_push_subscriptions.sql`
- `tests/unit/push-notifications.test.ts`

## Files to Modify

- `public/sw-custom.js` — ajouter notificationclick handler
- `app/(app)/pms/temperatures/page.tsx` — intégrer PushPermissionPrompt
- `app/api/cron/rappelconso/route.ts` — utiliser sendRappelAlert
- `app/api/cron/temperature-reminders/route.ts` — utiliser sendPMSReminder
- `app/api/cron/onboarding-notifications/route.ts` — utiliser sendOnboardingNotification

## Acceptance Criteria

- [ ] Navigateur accepte la permission push → subscription stockée dans Supabase
- [ ] Notification reçue en navigateur au clic sur "Activer les notifications"
- [ ] Si pas de subscription → email Resend envoyé (fallback)
- [ ] Clic notification → redirige vers l'URL dans `data.url`
- [ ] Tests Vitest passent (mock web-push)

## Testing Protocol

### Vitest
```bash
npm run test:unit -- push-notifications
```

### Playwright
```bash
npx playwright test tests/e2e/pwa.spec.ts --project="Desktop Chrome"
# Vérifier que /api/push/subscribe accepte un JSON de subscription valide
```

### Curl cron (vérifie envoi push)
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/temperature-reminders
```

## Git

- Branch: `phase-6/finitions`
- Commit message prefix: `Task 6.3:`

## PROGRESS.md Update

Marquer Task 6.3 ✅ dans PROGRESS.md.
