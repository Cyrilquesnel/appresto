# Task 7.5: Déploiement Vercel Production

## Objective
Application déployée en production sur Vercel (région fra1) avec Supabase Cloud EU (Frankfurt), variables d'environnement configurées, domaine custom si disponible.

## Context
Ce task est essentiellement une checklist de configuration manuelle + vérification. Les migrations production sont appliquées via CI. L'URL cible est `app.miseenplace.fr` si le domaine est acheté, sinon `mise-en-place.vercel.app`.

## Dependencies
- Toutes les phases précédentes complètes (1 → 7.4)

## Blocked By
- Toutes phases précédentes

## Implementation Plan

### Step 1: Créer le projet Supabase Cloud Production

```bash
# Via Supabase CLI
supabase projects create mise-en-place-prod \
  --org-id $SUPABASE_ORG_ID \
  --region eu-central-1 \
  --db-password $PROD_DB_PASSWORD

# Récupérer les credentials
supabase projects list
# Copier: SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY + DB_URL
```

### Step 2: Appliquer les migrations en production

```bash
# Depuis la branch main (après merge)
supabase db push --db-url "postgresql://postgres:$PROD_DB_PASSWORD@db.xxxx.supabase.co:5432/postgres"

# Vérifier les migrations appliquées
supabase db diff --schema public --linked
```

### Step 3: Créer le projet Vercel Production

```bash
vercel link
# Suivre les prompts: nom projet, org

# Configurer la région
vercel env add VERCEL_REGION fra1

# Déployer en production
vercel --prod
```

### Step 4: Variables d'environnement Vercel Dashboard

```
# Configurer TOUTES ces variables dans Vercel Dashboard → Settings → Environment Variables
# NE PAS les committer dans git

# Production uniquement (Environment: Production)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx
SUPABASE_DB_URL=postgresql://postgres:xxxx@db.xxxx.supabase.co:5432/postgres

GEMINI_API_KEY=AIzaxxxx
ANTHROPIC_API_KEY=sk-ant-xxxx

UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

RESEND_API_KEY=re_xxxx
VAPID_PUBLIC_KEY=BNxxxx
VAPID_PRIVATE_KEY=xxxx

WHATSAPP_ACCESS_TOKEN=EAAxxxx
WHATSAPP_PHONE_NUMBER_ID=xxxx

NEXT_PUBLIC_POSTHOG_KEY=phc_xxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
SENTRY_AUTH_TOKEN=sntrys_xxxx
SENTRY_ORG=la-fabrique-alimentaire
SENTRY_PROJECT=mise-en-place

BETTERUPTIME_HEARTBEAT_URL=https://uptime.betterstack.com/api/v1/heartbeat/xxxx
BETTERUPTIME_HEARTBEAT_TEMP_URL=https://uptime.betterstack.com/api/v1/heartbeat/yyyy

NEXT_PUBLIC_APP_URL=https://app.miseenplace.fr
CRON_SECRET=xxxx_generer_random_secret_32chars
REQUIRE_PAYMENT_METHOD=false
```

### Step 5: Domaine custom (si disponible)

```bash
# Via Vercel CLI
vercel domains add app.miseenplace.fr

# Configurer DNS chez le registrar:
# CNAME app.miseenplace.fr → cname.vercel-dns.com
# Attendre propagation DNS (jusqu'à 48h)

# Vérifier
vercel domains inspect app.miseenplace.fr
```

### Step 6: Smoke test production

```bash
# Test /api/health
curl https://app.miseenplace.fr/api/health
# Attendu: {"status":"ok","timestamp":"...","version":"abc1234"}

# Test auth
curl -s https://app.miseenplace.fr/api/health | jq '.status'

# Vérifier crons Vercel
# Dashboard Vercel → Settings → Crons → vérifier 3 crons listés
```

### Step 7: app/api/health/route.ts — version production complète

```typescript
// app/api/health/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'edge'  // Health check en Edge pour la rapidité

export async function GET(req: NextRequest) {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    region: process.env.VERCEL_REGION ?? 'dev',
    environment: process.env.NODE_ENV,
  })
}
```

### Step 8: Test RLS en production

```bash
# Créer 2 comptes sur app.miseenplace.fr/register
# Vérifier qu'un compte ne voit pas les données de l'autre

# Test curl direct Supabase (avec anon key — comme un client)
curl "https://xxxx.supabase.co/rest/v1/plats?select=*" \
  -H "apikey: $PROD_ANON_KEY" \
  -H "Authorization: Bearer $USER_A_JWT"
# Attendu: uniquement les plats de l'user A
```

### Step 9: Vérification finale

```
Checklist de validation production:

□ App accessible en HTTPS (certificat SSL valide)
□ /api/health → 200 avec version git correct
□ Login / Register fonctionnel
□ Photo analyse plat fonctionne (Gemini API connectée)
□ Dashboard charge en < 1s
□ RLS active (2 comptes, isolation vérifiée)
□ Crons listés dans Vercel dashboard
□ Sentry: aucune erreur au démarrage (dashboard propre)
□ BetterUptime: monitor vert
□ Domaine custom actif (si configuré)
```

## Files to Create

- Aucun (configuration uniquement + app/api/health/route.ts si pas encore créé en 7.1)

## Files to Modify

- `app/api/health/route.ts` — version Edge + region + env

## Configuration manuelle requise (non automatisable)

1. Créer projet Supabase Cloud EU (Frankfurt)
2. Appliquer migrations production
3. Créer projet Vercel + configurer région fra1
4. Configurer toutes les variables env dans Vercel dashboard
5. (Optionnel) Configurer domaine custom DNS

## Acceptance Criteria

- [ ] App accessible en production HTTPS
- [ ] `/api/health` → 200 en production avec version git
- [ ] Auth fonctionne en production (register + login)
- [ ] RLS active (test avec 2 comptes — isolation vérifiée)
- [ ] Crons Vercel listés dans dashboard avec schedules corrects
- [ ] Sentry: aucune erreur au démarrage
- [ ] BetterUptime: monitor vert

## Testing Protocol

### Playwright production smoke
```bash
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" npx playwright test tests/e2e/auth.spec.ts --project="Desktop Chrome"
```

### Curl
```bash
curl https://app.miseenplace.fr/api/health
```

### Vercel CLI
```bash
vercel ls --prod  # Voir les déploiements production
vercel inspect   # Inspecter le déploiement actuel
```

## Git

- Branch: `main` (déploiement production)
- Commit message prefix: `Task 7.5:`

## PROGRESS.md Update

Marquer Task 7.5 ✅ dans PROGRESS.md.
