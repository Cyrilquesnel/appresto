# Task 1.5: Health Check + Variables d'Environnement

## Objective
Créer l'endpoint `/api/health` qui vérifie la connectivité Supabase, finaliser `.env.example` complet, et configurer `.env.local` pour le développement local.

## Context
Le health check est utilisé par BetterUptime (monitoring), les smoke tests CI/CD, et Vercel pour vérifier que le déploiement est fonctionnel.

## Dependencies
- Task 1.4 — tRPC + Supabase clients opérationnels

## Blocked By
- Task 1.4

## Implementation Plan

### Step 1: Endpoint health check

```typescript
// app/api/health/route.ts
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, boolean> = {}
  const startTime = Date.now()

  // Check Supabase connectivity
  try {
    const supabase = createClient()
    const { error } = await supabase.from('restaurants').select('id').limit(1)
    checks.supabase = !error
  } catch {
    checks.supabase = false
  }

  const allOk = Object.values(checks).every(Boolean)
  const duration = Date.now() - startTime

  return Response.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    },
    { status: allOk ? 200 : 503 }
  )
}
```

### Step 2: .env.example complet

```bash
# .env.example — Toutes les variables requises pour Mise en Place
# Copier ce fichier en .env.local et remplir les valeurs

# ══════════════════════════════════════════════
# SUPABASE
# ══════════════════════════════════════════════
# URL publique du projet Supabase (ex: http://localhost:54321 en local)
NEXT_PUBLIC_SUPABASE_URL=

# Clé anonyme publique (visible côté client — OK)
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Clé service role (SECRÈTE — jamais côté client, jamais dans NEXT_PUBLIC_*)
SUPABASE_SERVICE_ROLE_KEY=

# URL de connexion directe PostgreSQL (pour migrations CI/CD)
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

# ══════════════════════════════════════════════
# INTELLIGENCE ARTIFICIELLE
# ══════════════════════════════════════════════
# Google AI Studio — Gemini 2.0 Flash (analyse photos plats + OCR factures)
# Free tier : 1500 req/jour — suffisant pour beta
GEMINI_API_KEY=

# Anthropic — Claude Haiku 4.5 (enrichissement allergènes, génération HACCP)
# ~$2/mois pour beta
ANTHROPIC_API_KEY=

# ══════════════════════════════════════════════
# RATE LIMITING (Upstash Redis)
# ══════════════════════════════════════════════
# Upstash Console → créer une base Redis → copier les credentials
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ══════════════════════════════════════════════
# EMAIL (Resend)
# ══════════════════════════════════════════════
# resend.com → créer un compte → API Keys
# Free tier : 3000 emails/mois
RESEND_API_KEY=

# ══════════════════════════════════════════════
# PUSH NOTIFICATIONS (Web Push VAPID)
# ══════════════════════════════════════════════
# Générer avec : npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ══════════════════════════════════════════════
# WHATSAPP BUSINESS (Meta Cloud API)
# ══════════════════════════════════════════════
# developers.facebook.com → créer app → WhatsApp → Phone Numbers
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# ══════════════════════════════════════════════
# MONITORING
# ══════════════════════════════════════════════
# PostHog (analytics RGPD-friendly, région EU)
# app.posthog.com → créer projet EU → Project Settings → API Keys
NEXT_PUBLIC_POSTHOG_KEY=

# Sentry (error tracking)
# sentry.io → créer projet Next.js → Settings → Client Keys
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# BetterUptime (heartbeats crons PMS)
# betterstack.com → Heartbeats → créer heartbeat → copier URL
BETTERUPTIME_HEARTBEAT_URL=

# ══════════════════════════════════════════════
# APPLICATION
# ══════════════════════════════════════════════
# URL publique de l'app (http://localhost:3000 en dev, https://app.miseenplace.fr en prod)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Secret pour authentifier les crons Vercel (générer avec : openssl rand -hex 32)
CRON_SECRET=

# Feature flag : CB requise au checkout Stripe (false = freemium sans CB)
REQUIRE_PAYMENT_METHOD=false

# ══════════════════════════════════════════════
# STRIPE (Phase commercialisation uniquement — laisser vide en beta)
# ══════════════════════════════════════════════
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# STRIPE_PRICE_STARTER=
# STRIPE_PRICE_PRO=
# STRIPE_PRICE_MULTI=
```

### Step 3: .env.local pour développement

Créer `.env.local` (gitignored) avec les valeurs locales Supabase :
```bash
# Valeurs obtenues après `supabase start`
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copier depuis output de supabase start>
SUPABASE_SERVICE_ROLE_KEY=<copier depuis output de supabase start>
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=dev-secret-local
REQUIRE_PAYMENT_METHOD=false
# Les autres variables (Gemini, Anthropic, etc.) peuvent être laissées vides en dev initial
```

### Step 4: Vérifier .gitignore

S'assurer que `.gitignore` contient :
```
# Environment files
.env*.local
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production
```

**CRITIQUE** : ne jamais commiter `.env.local` ni `.env.production`.

### Step 5: Test du health check

```bash
# Avec supabase en cours
curl http://localhost:3000/api/health
# Attendu :
# {"status":"ok","checks":{"supabase":true},"duration_ms":12,"timestamp":"..."}
```

## Files to Create

- `app/api/health/route.ts`
- `.env.example` (complet)
- `.env.local` (local uniquement, gitignored)

## Files to Modify

- `.gitignore` — s'assurer que .env*.local est présent

## Contracts

### Provides (pour tâches suivantes)
- `GET /api/health` → `{ status: "ok"|"degraded", checks: { supabase: bool }, duration_ms: number }`
- Toutes les variables d'environnement documentées dans `.env.example`

## Acceptance Criteria

- [ ] `curl http://localhost:3000/api/health` → `{"status":"ok",...}` (HTTP 200)
- [ ] Si Supabase down → `{"status":"degraded",...}` (HTTP 503)
- [ ] `.env.example` contient toutes les variables (Supabase, AI, Upstash, Resend, VAPID, WhatsApp, monitoring, app)
- [ ] `.env.local` est gitignored (vérifier avec `git status`)
- [ ] Aucune variable `SUPABASE_SERVICE_ROLE_KEY` dans une variable `NEXT_PUBLIC_*`

## Testing Protocol

### API Testing
```bash
curl http://localhost:3000/api/health
# → {"status":"ok","checks":{"supabase":true},...}
```

### Security Check
```bash
# Vérifier qu'aucun secret n'est dans NEXT_PUBLIC_*
grep -r "NEXT_PUBLIC_" .env.example | grep -v "SUPABASE_URL\|SUPABASE_ANON\|APP_URL\|POSTHOG\|SENTRY_DSN\|POSTHOG"
# Doit être vide (pas de secrets dans NEXT_PUBLIC_*)
```

```bash
git status  # .env.local ne doit PAS apparaître
```

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.5:`
- Ne JAMAIS commiter .env.local

## PROGRESS.md Update

Marquer Task 1.5 ✅ dans PROGRESS.md.
