# Task 7.1: GitHub Actions — Pipeline Complet

## Objective
Pipeline CI/CD complet : quality → unit → integration → e2e preview → deploy production. PR → preview automatique, merge main → production.

## Context
Pipeline en 5 jobs parallèles + deploy séquentiel. Secrets GitHub requis. E2E sur Vercel preview (pas localhost). Coverage ≥ 80%.

## Dependencies
- Task 1.6 — CI/CD initial configuré

## Blocked By
- Task 1.6

## Implementation Plan

### Step 1: .github/workflows/ci.yml

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Quality (typecheck + lint)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npx prettier --check "**/*.{ts,tsx,json}"

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false

  integration-tests:
    name: Integration Tests (Supabase + pgTAP)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Start Supabase local
        run: supabase start
      - name: Run migrations
        run: supabase db push
      - name: Run pgTAP tests
        run: supabase test db

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: [quality, unit-tests]
    if: github.event_name == 'pull_request'
    outputs:
      preview_url: ${{ steps.deploy.outputs.preview_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Install Vercel CLI
        run: npm install -g vercel@latest
      - name: Deploy to Vercel Preview
        id: deploy
        run: |
          DEPLOY_URL=$(vercel deploy --token=${{ secrets.VERCEL_TOKEN }} \
            --org-id=${{ secrets.VERCEL_ORG_ID }} \
            --project-id=${{ secrets.VERCEL_PROJECT_ID }} \
            --yes 2>/dev/null)
          echo "preview_url=$DEPLOY_URL" >> $GITHUB_OUTPUT
          echo "Preview URL: $DEPLOY_URL"
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: [deploy-preview]
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium webkit
      - name: Run E2E tests
        run: npx playwright test --project="Desktop Chrome" --project="iPhone 14 Safari"
        env:
          PLAYWRIGHT_BASE_URL: ${{ needs.deploy-preview.outputs.preview_url }}
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Step 2: .github/workflows/deploy-prod.yml

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Run production migrations
        run: |
          npx supabase db push --db-url ${{ secrets.SUPABASE_PROD_DB_URL }}

      - name: Deploy to Vercel Production
        run: |
          vercel deploy --prod \
            --token=${{ secrets.VERCEL_TOKEN }} \
            --org-id=${{ secrets.VERCEL_ORG_ID }} \
            --project-id=${{ secrets.VERCEL_PROJECT_ID }} \
            --yes

      - name: Smoke test
        run: |
          sleep 30 # Attendre le déploiement
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.PROD_URL }}/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "Smoke test failed: /api/health returned $STATUS"
            exit 1
          fi
          echo "✅ Smoke test passed"
```

### Step 3: app/api/health/route.ts

```typescript
// app/api/health/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    // Test connexion BDD
    const { error } = await supabase.from('restaurants').select('id').limit(1)
    if (error) throw error

    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    })
  } catch (error) {
    return Response.json(
      { status: 'error', error: (error as Error).message },
      { status: 503 }
    )
  }
}
```

### Step 4: Tests E2E fixtures

```
# Créer les images de test
tests/fixtures/dish-steak.jpg     — Photo d'un steak (≥ 100KB, JPEG valide)
tests/fixtures/invoice-sample.jpg — Photo facture fournisseur (≥ 100KB, JPEG valide)
```

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test('register → login → dashboard', async ({ page }) => {
  const email = `test-${Date.now()}@miseenplace.fr`
  const password = 'TestPassword123!'

  // Register
  await page.goto('/register')
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', password)
  await page.fill('[data-testid="restaurant-nom"]', 'Restaurant Test CI')
  await page.click('[data-testid="register-submit"]')

  // Should redirect to onboarding or dashboard
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 })

  // Login test
  await page.goto('/login')
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', password)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })

  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
})
```

### Step 5: playwright.config.ts — configuration multi-project

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['github']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iPhone 14 Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
})
```

## Files to Create

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-prod.yml`
- `app/api/health/route.ts`
- `tests/e2e/auth.spec.ts`
- `tests/fixtures/dish-steak.jpg` (image réelle nécessaire)
- `tests/fixtures/invoice-sample.jpg`
- `playwright.config.ts` (si pas déjà créé en Task 1.6)

## Files to Modify

- `package.json` — s'assurer que `test:unit`, `typecheck`, `lint` sont définis

## Secrets GitHub à configurer

```
VERCEL_TOKEN          — Token Vercel
VERCEL_ORG_ID         — ID org Vercel
VERCEL_PROJECT_ID     — ID projet Vercel
SUPABASE_PROD_DB_URL  — URL BDD production
PROD_URL              — URL production (https://app.miseenplace.fr)
CODECOV_TOKEN         — Token Codecov (optionnel)
```

## Acceptance Criteria

- [ ] PR → tous les jobs verts → deploy preview avec URL Vercel commentée
- [ ] Merge main → deploy production automatique
- [ ] Coverage rapport uploadé (Codecov)
- [ ] E2E tests : auth + flux photo + PMS offline verts
- [ ] Smoke test production : /api/health → 200
- [ ] Playwright: screenshots des échecs uploadés comme artifacts

## Testing Protocol

```bash
# Test local pipeline (simulation)
npm run typecheck && npm run lint && npm run test:unit
npx playwright test tests/e2e/auth.spec.ts --project="Desktop Chrome"

# Ouvrir une PR test → vérifier GitHub Actions
# Merger vers main → vérifier deploy-prod.yml
```

## Git

- Branch: `phase-7/cicd`
- Commit message prefix: `Task 7.1:`

## PROGRESS.md Update

Marquer Task 7.1 ✅ dans PROGRESS.md.
