# Recherche : CI/CD DevOps + Testing

**Date**: 2026-04-12
**Stack**: Next.js 14 + Supabase + Vercel + tRPC + Vitest + Playwright

---

## 1. GitHub Actions + Vercel

### Pipeline complet recommandé

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  # ── JOB 1 : Qualité (2 min) ──────────────────────────────
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck      # tsc --noEmit
      - run: npm run lint           # eslint
      - run: npm run format:check   # prettier --check

  # ── JOB 2 : Tests unitaires (3 min) ──────────────────────
  unit-tests:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit      # vitest run
      - uses: codecov/codecov-action@v4

  # ── JOB 3 : Tests intégration Supabase (5 min) ───────────
  integration-tests:
    needs: quality
    runs-on: ubuntu-latest
    services:
      supabase:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start --ignore-health-check
      - run: supabase db push    # applique migrations
      - run: npm run test:integration
      - run: supabase stop

  # ── JOB 4 : Deploy preview + E2E (10 min) ────────────────
  e2e:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - name: Deploy to Vercel Preview
        id: deploy
        run: |
          npm install -g vercel
          PREVIEW_URL=$(vercel deploy --token=${{ secrets.VERCEL_TOKEN }} --yes)
          echo "preview_url=$PREVIEW_URL" >> $GITHUB_OUTPUT
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.deploy.outputs.preview_url }}

  # ── JOB 5 : Deploy production (3 min) ────────────────────
  deploy-production:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Run DB migrations
        run: |
          npx supabase db push --db-url=${{ secrets.SUPABASE_DB_URL }}
      - name: Deploy to Vercel Production
        run: |
          npm install -g vercel
          vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
      - name: Smoke test
        run: |
          curl -f https://app.miseenplace.fr/api/health || exit 1
```

**Durées totales :**
- PR : ~18-22 min
- Merge to main : ~12-15 min

---

## 2. Supabase CLI — Workflow migrations

### Setup local

```bash
# Installation
npm install -g supabase

# Init projet
supabase init

# Démarrage stack locale (Docker)
supabase start
# → PostgreSQL:5432, API:54321, Studio:54323, Inbucket:54324

# Créer une migration
supabase migration new create_restaurants_table

# Appliquer migrations
supabase db push    # sur remote
supabase db reset   # reset local + re-apply tout

# Générer types TypeScript depuis schema
supabase gen types typescript --local > types/supabase.ts
```

### Structure migrations

```
supabase/
  migrations/
    20260501000001_initial_schema.sql
    20260501000002_rls_policies.sql
    20260502000001_pms_tables.sql
    20260502000002_triggers_cascade.sql
  seed.sql          # données initiales (catalogue ingrédients)
  config.toml
```

### Test des politiques RLS (pgTAP)

```sql
-- supabase/tests/rls_restaurant_isolation.test.sql
BEGIN;
SELECT plan(6);

-- Setup : 2 restaurants, 2 users
INSERT INTO auth.users (id, email) VALUES
  ('user-1', 'chef1@test.com'),
  ('user-2', 'chef2@test.com');

INSERT INTO restaurants (id, nom, owner_id) VALUES
  ('resto-1', 'Le Bistrot', 'user-1'),
  ('resto-2', 'La Brasserie', 'user-2');

INSERT INTO plats (id, restaurant_id, nom) VALUES
  ('plat-1', 'resto-1', 'Boeuf bourguignon'),
  ('plat-2', 'resto-2', 'Sole meunière');

-- Test 1 : user-1 voit seulement ses plats
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-1"}';
SELECT is(
  (SELECT count(*) FROM plats)::int,
  1,
  'user-1 voit 1 seul plat'
);

-- Test 2 : user-1 ne peut pas lire les plats de user-2
SELECT is(
  (SELECT count(*) FROM plats WHERE id = 'plat-2')::int,
  0,
  'user-1 ne voit pas les plats de user-2'
);

-- Test 3 : user-1 ne peut pas modifier les plats de user-2
SELECT throws_ok(
  'UPDATE plats SET nom = ''Hack'' WHERE id = ''plat-2''',
  'user-1 ne peut pas modifier les plats de user-2'
);

SELECT finish();
ROLLBACK;
```

---

## 3. Vitest — Configuration Next.js App Router

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { lines: 80, functions: 80 }
    }
  }
})
```

### Mocks pour Supabase + AI

```typescript
// tests/mocks/supabase.ts
import { vi } from 'vitest'

export const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } }
    })
  }
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}))

// tests/mocks/gemini.ts
vi.mock('@/lib/ai/gemini', () => ({
  analyzeWithRetry: vi.fn().mockResolvedValue({
    type_plat: 'Viande grillée',
    ingredients_detectes: [
      { nom: 'bœuf', categorie: 'viande', visible: true, confiance: 0.95 },
      { nom: 'haricots verts', categorie: 'legume', visible: true, confiance: 0.88 }
    ],
    confiance_globale: 0.91
  })
}))

// tests/mocks/anthropic.ts
vi.mock('@/lib/ai/claude-enrichment', () => ({
  enrichIngredients: vi.fn().mockResolvedValue({
    bœuf: { allergenes_confirmes: [], grammage_portion: 180, kcal_par_100g: 250 }
  })
}))
```

---

## 4. Playwright — Tests E2E Mobile PWA

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['junit', { outputFile: 'test-results/results.xml' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'iPhone 14 Safari',
      use: {
        ...devices['iPhone 14'],
        browserName: 'webkit',
      }
    },
    {
      name: 'Android Chrome',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      }
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
```

### Test flux photo → fiche technique

```typescript
// tests/e2e/dish-photo-flow.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

test('Flux complet : photo → fiche technique', async ({ page }) => {
  // Connexion
  await page.goto('/login')
  await page.fill('[name=email]', 'beta@test.com')
  await page.fill('[name=password]', 'testpass123')
  await page.click('[type=submit]')
  await expect(page).toHaveURL('/dashboard')

  // Naviguer vers nouveau plat
  await page.click('[data-testid=add-dish-btn]')
  await expect(page).toHaveURL('/plats/nouveau')

  // Upload photo (mock caméra avec fichier)
  const fileInput = page.locator('input[type=file][accept*="image"]')
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/dish-steak.jpg'))

  // Attente analyse IA
  await expect(page.locator('[data-testid=ai-loading]')).toBeVisible()
  await expect(page.locator('[data-testid=ingredients-list]')).toBeVisible({ timeout: 15000 })

  // Validation ingrédients détectés
  await expect(page.locator('[data-testid=ingredient-item]')).toHaveCount({ minimum: 2 })

  // Sauvegarder la fiche
  await page.fill('[name=dish-name]', 'Steak frites')
  await page.click('[data-testid=save-fiche]')
  
  // Vérifier redirection vers fiche technique
  await expect(page).toHaveURL(/\/plats\/[a-z0-9-]+/)
  await expect(page.locator('[data-testid=food-cost]')).toBeVisible()
})
```

### Test PMS offline (Background Sync)

```typescript
// tests/e2e/pms-offline.spec.ts
test('Relevé température offline → sync automatique', async ({ page, context }) => {
  await page.goto('/pms/temperatures')
  
  // Simuler perte de réseau
  await context.setOffline(true)
  
  // Saisir relevé température
  await page.click('[data-testid=frigo-principal]')
  await page.fill('[name=temperature]', '3.5')
  await page.click('[data-testid=save-releve]')
  
  // Vérifier que c'est en queue
  await expect(page.locator('[data-testid=offline-badge]')).toBeVisible()
  await expect(page.locator('[data-testid=sync-queue-count]')).toHaveText('1')
  
  // Remettre le réseau
  await context.setOffline(false)
  
  // Attendre sync automatique
  await expect(page.locator('[data-testid=sync-queue-count]')).toHaveText('0', { timeout: 10000 })
  await expect(page.locator('[data-testid=releve-saved]')).toBeVisible()
})
```

---

## 5. Monitoring Stack

### Sentry — Next.js App Router

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% des transactions
  environment: process.env.NODE_ENV,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true })
  ],
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
})

// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  integrations: [Sentry.prismaIntegration()],
})
```

### BetterUptime — Monitoring crons PMS

```
# Endpoints à surveiller
https://app.miseenplace.fr/api/health          → uptime check toutes les 2 min
https://app.miseenplace.fr/api/cron/temperatures → heartbeat check (dead man's switch)
https://app.miseenplace.fr/api/cron/rappelconso  → heartbeat check

# Dead man's switch : si l'endpoint /api/cron/temperatures ne ping pas
# BetterUptime dans les 26h → alerte Slack + email
```

```typescript
// app/api/cron/temperatures/route.ts
export async function GET() {
  // ... logique relevé
  
  // Ping BetterUptime heartbeat en fin de cron
  await fetch(process.env.BETTERUPTIME_HEARTBEAT_URL!)
  
  return NextResponse.json({ ok: true })
}
```

---

## 6. PostHog — Analytics RGPD

```typescript
// lib/posthog.ts
import PostHog from 'posthog-node'

export const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  host: 'https://eu.i.posthog.com',  // EU region
  flushAt: 20,
  flushInterval: 10000,
})

// Events clés à tracker
const EVENTS = {
  DISH_PHOTO_ANALYZED: 'dish_photo_analyzed',
  FICHE_TECHNIQUE_SAVED: 'fiche_technique_saved',
  BON_COMMANDE_GENERATED: 'bon_commande_generated',
  TEMPERATURE_LOGGED: 'temperature_logged',
  DDPP_EXPORT_GENERATED: 'ddpp_export_generated',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
}
```

---

## 7. Load Testing — k6

```javascript
// tests/load/500-restaurants.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // montée en charge
    { duration: '5m', target: 500 },   // plateau 500 restaurants
    { duration: '2m', target: 0 },     // descente
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% des requêtes < 2s
    http_req_failed: ['rate<0.01'],     // < 1% d'erreurs
  }
}

export default function() {
  // Dashboard
  const dashboard = http.get('https://staging.miseenplace.fr/api/trpc/dashboard.get', {
    headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN}` }
  })
  check(dashboard, { 'dashboard OK': (r) => r.status === 200 })
  
  // Analyse image
  const formData = { image: http.file(open('./fixtures/dish.jpg', 'b'), 'dish.jpg') }
  const analysis = http.post('https://staging.miseenplace.fr/api/analyze-dish', formData)
  check(analysis, { 'analysis OK': (r) => r.status === 200 })
  
  sleep(1)
}
```

---

## 8. Variables d'environnement — Structure complète

```bash
# .env.local (développement)
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

# AI
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=   # Whisper V2

# Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Notifications
RESEND_API_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Monitoring
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
BETTERUPTIME_HEARTBEAT_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
VAPID_PUBLIC_KEY=   # Web Push
VAPID_PRIVATE_KEY=
```

---

## 9. Health Check Endpoint

```typescript
// app/api/health/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const checks: Record<string, boolean> = {}
  
  // Check Supabase
  try {
    const supabase = createClient()
    await supabase.from('restaurants').select('id').limit(1)
    checks.supabase = true
  } catch { checks.supabase = false }
  
  const allOk = Object.values(checks).every(Boolean)
  
  return Response.json(
    { status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}
```
