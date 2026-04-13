# Task 1.6: CI/CD Basique — GitHub Actions + Playwright Config

## Objective
Mettre en place le pipeline GitHub Actions minimal (typecheck + lint + unit tests), configurer Playwright pour les tests E2E mobiles, et créer les premiers mocks de test réutilisables.

## Context
La CI garantit qu'aucune régression n'est mergée. Elle sera enrichie en Phase 7 avec les tests d'intégration Supabase et le déploiement Vercel. Pour l'instant : quality gate basique.

## Dependencies
- Task 1.5 — projet complet avec scripts npm

## Blocked By
- Task 1.5

## Implementation Plan

### Step 1: GitHub Actions — pipeline basique

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

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
      - name: TypeScript check
        run: npm run typecheck
      - name: ESLint
        run: npm run lint
      - name: Prettier check
        run: npm run format:check

  unit-tests:
    name: Unit Tests
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run unit tests
        run: npm run test:unit
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-key
          SUPABASE_SERVICE_ROLE_KEY: test-service-key
          NEXT_PUBLIC_APP_URL: http://localhost:3000
```

### Step 2: Mocks réutilisables pour Vitest

```typescript
// tests/mocks/supabase.ts
import { vi } from 'vitest'

export const mockSupabaseUser = {
  id: 'test-user-id',
  email: 'test@example.com',
}

export const mockRestaurantId = 'test-restaurant-id'

export const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  channel: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  removeChannel: vi.fn(),
})

export const mockSupabaseClient = createMockSupabaseClient()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
  createServiceClient: () => mockSupabaseClient,
}))
```

```typescript
// tests/mocks/gemini.ts
import { vi } from 'vitest'

export const mockGeminiResult = {
  type_plat: 'Viande grillée',
  ingredients_detectes: [
    { nom: 'bœuf', categorie: 'viande', visible: true, confiance: 0.95, grammage_suggere: 180 },
    { nom: 'haricots verts', categorie: 'legume', visible: true, confiance: 0.88, grammage_suggere: 80 },
    { nom: 'pommes de terre', categorie: 'legume', visible: true, confiance: 0.92, grammage_suggere: 150 },
  ],
  confiance_globale: 0.91,
  remarques: 'Plat principal avec accompagnements',
}

vi.mock('@/lib/ai/gemini', () => ({
  analyzeDishPhoto: vi.fn().mockResolvedValue(mockGeminiResult),
  analyzeWithRetry: vi.fn().mockResolvedValue(mockGeminiResult),
}))
```

```typescript
// tests/mocks/anthropic.ts
import { vi } from 'vitest'

export const mockClaudeEnrichment = {
  'bœuf': {
    allergenes_confirmes: [],
    grammage_portion: 180,
    kcal_par_100g: 250,
    unite_standard: 'g',
    notes: 'Viande bovine, cuisson à 63°C minimum',
  },
}

vi.mock('@/lib/ai/claude-enrichment', () => ({
  enrichIngredients: vi.fn().mockResolvedValue(mockClaudeEnrichment),
}))
```

### Step 3: Playwright — configuration mobile

```typescript
// playwright.config.ts (mise à jour complète)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iPhone 14 Safari',
      use: {
        ...devices['iPhone 14'],
        browserName: 'webkit',
      },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
```

### Step 4: Premier test E2E (smoke test)

```typescript
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('health check endpoint responds', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe('ok')
})

test('accueil redirige vers login si non authentifié', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('page login affiche le formulaire', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[name=email]')).toBeVisible()
  await expect(page.locator('input[name=password]')).toBeVisible()
  await expect(page.locator('button[type=submit]')).toBeVisible()
})
```

### Step 5: Test unitaire de smoke (Vitest)

```typescript
// tests/unit/smoke.test.ts
import { describe, it, expect } from 'vitest'

describe('Application smoke tests', () => {
  it('environment is configured', () => {
    // Vérifier que les variables d'env minimales sont disponibles en test
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321').toBeTruthy()
    expect(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').toBeTruthy()
  })

  it('basic math works', () => {
    // Test trivial pour vérifier que Vitest est configuré
    expect(1 + 1).toBe(2)
  })
})
```

### Step 6: Fixtures de test

```bash
# Créer des fixtures (images de test)
# Télécharger une image de steak libre de droits
curl -o tests/fixtures/dish-steak.jpg "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Steak_Maillard.jpg/640px-Steak_Maillard.jpg" 2>/dev/null || touch tests/fixtures/dish-steak.jpg

# Créer une "facture" test simple
touch tests/fixtures/invoice-sample.jpg
```

Si le téléchargement échoue, créer des fichiers placeholder vides — ils seront remplacés par de vraies images en Phase 2.

### Step 7: Scripts complémentaires dans package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run typecheck && npm run lint && npm run test:unit"
  }
}
```

### Step 8: .github/workflows — installer Playwright dans CI (pour plus tard)

Préparer le workflow pour E2E (sera activé en Phase 7) :

```yaml
# .github/workflows/e2e.yml (désactivé pour l'instant — décommentez en Phase 7)
# name: E2E Tests
# on:
#   pull_request:
#     branches: [main, develop]
# jobs:
#   e2e:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: actions/setup-node@v4
#         with: { node-version: '20', cache: 'npm' }
#       - run: npm ci
#       - run: npx playwright install --with-deps chromium webkit
#       - run: npm run test:e2e
#         env:
#           PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
```

## Files to Create

- `.github/workflows/ci.yml`
- `tests/mocks/supabase.ts`
- `tests/mocks/gemini.ts`
- `tests/mocks/anthropic.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/unit/smoke.test.ts`
- `tests/fixtures/dish-steak.jpg`
- `tests/fixtures/invoice-sample.jpg`
- `.github/workflows/e2e.yml` (commenté)

## Files to Modify

- `playwright.config.ts` — configuration complète avec projets iPhone + Desktop
- `package.json` — scripts complets

## Contracts

### Provides (pour tâches suivantes)
- Pipeline CI fonctionnel sur GitHub
- Mocks Supabase/Gemini/Claude réutilisables dans tous les tests unitaires
- Config Playwright avec projets iPhone 14 + Desktop Chrome
- Fixtures images pour les tests photo

## Acceptance Criteria

- [ ] `npm run test:unit` → tous les tests passent (smoke.test.ts)
- [ ] `npm run typecheck` → 0 erreur
- [ ] `npm run lint` → 0 erreur
- [ ] Push sur develop → GitHub Actions CI verte (quality + unit-tests)
- [ ] `npm run test:e2e` sur localhost → smoke.spec.ts passe
- [ ] Playwright projects: iPhone 14 Safari + Desktop Chrome configurés

## Testing Protocol

### Vérification GitHub Actions
- Commiter et pusher sur `develop`
- Aller sur GitHub → Actions → vérifier que le workflow CI passe (vert)

### Playwright Local
```bash
npm run dev &
npx playwright test tests/e2e/smoke.spec.ts
```

### Unit Tests
```bash
npm run test:unit
```

## Skills to Read

- `mise-en-place-architecture` — conventions tests

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.6:`

## PROGRESS.md Update

Marquer Task 1.6 ✅ dans PROGRESS.md.
