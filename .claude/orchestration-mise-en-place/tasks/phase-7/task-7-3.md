# Task 7.3: BetterUptime + Crons Vercel

## Objective
BetterUptime configuré pour monitoring uptime + heartbeats crons PMS/RappelConso. Tous les crons Vercel configurés et fonctionnels.

## Context
3 crons Vercel: rappelconso (21h), temperature-reminders (7h + 17h), onboarding-notifications (10h). BetterUptime surveille `/api/health` toutes les 2 min et reçoit des heartbeats de chaque cron. Si un cron ne ping pas en 26h → alerte email.

## Dependencies
- Task 5.5 — RappelConso cron opérationnel
- Task 5.1 — température cron opérationnel

## Blocked By
- Tasks 5.5 + 5.1

## Implementation Plan

### Step 1: vercel.json — crons complets

```json
{
  "crons": [
    {
      "path": "/api/cron/rappelconso",
      "schedule": "0 21 * * *"
    },
    {
      "path": "/api/cron/temperature-reminders",
      "schedule": "0 7,17 * * *"
    },
    {
      "path": "/api/cron/onboarding-notifications",
      "schedule": "0 10 * * *"
    }
  ]
}
```

### Step 2: app/api/cron/temperature-reminders/route.ts

```typescript
// app/api/cron/temperature-reminders/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPMSReminder } from '@/lib/push-notifications'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  let notified = 0

  try {
    // Récupérer tous les restaurants actifs avec subscriptions push
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription, restaurant_id')

    for (const sub of (subscriptions ?? [])) {
      try {
        await sendPMSReminder(sub.subscription)
        notified++
      } catch (err) {
        // Subscription expirée → supprimer
        if ((err as any)?.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('restaurant_id', sub.restaurant_id)
          console.log(`[temperature-reminders] Subscription expirée supprimée: ${sub.restaurant_id}`)
        } else {
          console.error(`[temperature-reminders] Erreur push:`, err)
        }
      }
    }

    // Heartbeat BetterUptime
    if (process.env.BETTERUPTIME_HEARTBEAT_TEMP_URL) {
      await fetch(process.env.BETTERUPTIME_HEARTBEAT_TEMP_URL, { method: 'GET' }).catch(() => {})
    }

    console.log(`[temperature-reminders] ${notified} notifications envoyées`)
    return Response.json({ notified })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
```

### Step 3: Configuration BetterUptime

```
# Monitors à créer dans BetterUptime (https://betteruptime.com):

1. Monitor HTTP — Uptime check
   - URL: https://app.miseenplace.fr/api/health
   - Fréquence: 2 minutes
   - Méthode: GET
   - Codes attendus: 200
   - Nom: "Mise en Place — Uptime"

2. Heartbeat — Cron RappelConso
   - Nom: "Cron RappelConso (21h)"
   - Période: 26h (24h + 2h tolérance)
   - URL heartbeat → copier dans env: BETTERUPTIME_HEARTBEAT_URL

3. Heartbeat — Cron Températures
   - Nom: "Cron Températures (7h+17h)"
   - Période: 14h (entre les deux exécutions + tolérance)
   - URL heartbeat → copier dans env: BETTERUPTIME_HEARTBEAT_TEMP_URL

# Alertes: email + Slack (si workspace disponible)
```

### Step 4: Vérifier que tous les crons pinguent BetterUptime

```typescript
// Modifier app/api/cron/rappelconso/route.ts — déjà configuré en Task 5.5
// Vérifier que la ligne heartbeat est présente:
if (process.env.BETTERUPTIME_HEARTBEAT_URL) {
  await fetch(process.env.BETTERUPTIME_HEARTBEAT_URL, { method: 'GET' }).catch(() => {})
}

// Modifier app/api/cron/onboarding-notifications/route.ts
// Ajouter heartbeat à la fin (pas de heartbeat spécifique — log seulement)
```

### Step 5: Variables d'environnement

```bash
# .env.local + Vercel dashboard
BETTERUPTIME_HEARTBEAT_URL=https://uptime.betterstack.com/api/v1/heartbeat/xxxx  # cron rappelconso
BETTERUPTIME_HEARTBEAT_TEMP_URL=https://uptime.betterstack.com/api/v1/heartbeat/yyyy  # cron températures
```

### Step 6: Tests

```bash
# Test local — tous les crons
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/rappelconso
# Attendu: {"processed":N,"alerts":M}

curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/temperature-reminders
# Attendu: {"notified":N}

curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/onboarding-notifications
# Attendu: {"notified":N}

# Test sanity — sans secret → 401
curl http://localhost:3000/api/cron/rappelconso
# Attendu: 401 Unauthorized

# Test /api/health
curl http://localhost:3000/api/health
# Attendu: {"status":"ok","timestamp":"...","version":"..."}
```

## Files to Create

- `app/api/cron/temperature-reminders/route.ts`

## Files to Modify

- `vercel.json` — crons complets (3 schedules)
- `app/api/cron/rappelconso/route.ts` — s'assurer heartbeat présent
- `app/api/cron/onboarding-notifications/route.ts` — s'assurer CRON_SECRET check présent

## Acceptance Criteria

- [ ] `/api/health` monitoré sur BetterUptime (2 min interval)
- [ ] Heartbeat reçu dans BetterUptime après chaque cron manuellement déclenché
- [ ] Couper app 3 min → alerte BetterUptime email reçue
- [ ] Tous les crons → 401 sans secret, 200 avec secret
- [ ] vercel.json: 3 crons listés avec schedules corrects

## Testing Protocol

### Curl tests
```bash
# Tester tous les crons avec le secret
curl -H "Authorization: Bearer $CRON_SECRET" $PREVIEW_URL/api/cron/rappelconso
curl -H "Authorization: Bearer $CRON_SECRET" $PREVIEW_URL/api/cron/temperature-reminders
curl -H "Authorization: Bearer $CRON_SECRET" $PREVIEW_URL/api/cron/onboarding-notifications

# Tester /api/health
curl $PREVIEW_URL/api/health
```

### Vercel dashboard
```
1. Dashboard Vercel → Settings → Crons
2. Vérifier: 3 crons listés avec les bons schedules
3. "Run" manuellement → vérifier log output
```

### BetterUptime dashboard
```
1. Vérifier tous monitors verts
2. Vérifier heartbeat reçu dans les dernières 24h
3. Simuler DOWN (arrêter l'app) → vérifier alerte email
```

## Git

- Branch: `phase-7/cicd`
- Commit message prefix: `Task 7.3:`

## PROGRESS.md Update

Marquer Task 7.3 ✅ dans PROGRESS.md.
