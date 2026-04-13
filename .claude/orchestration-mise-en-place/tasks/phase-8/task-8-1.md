# Task 8.1: Tests Playwright Complets — Tous les Flux Utilisateur

## Objective
Suite de tests Playwright exhaustive couvrant tous les parcours utilisateurs en mobile (iPhone 14 Safari) et desktop. 0 échec, 0 test > 30s.

## Context
Phase 8 = validation finale avant beta. Les tests E2E valident les flux complets end-to-end sur l'URL de production ou staging. Chaque test simule un vrai utilisateur.

## Dependencies
- Toutes phases précédentes (1 → 7.R)

## Blocked By
- Task 7.R — production stable

## Implementation Plan

### Step 1: tests/e2e/dish-full-flow.spec.ts

```typescript
// tests/e2e/dish-full-flow.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

test('flux complet: photo → ingrédients validés → fiche technique créée', async ({ page }) => {
  // Auth (utiliser fixtures ou compte beta)
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  // Aller sur /plats/nouveau
  await page.goto('/plats/nouveau')
  await expect(page.locator('[data-testid="dish-camera"]')).toBeVisible()

  // Uploader une photo depuis fixture
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/dish-steak.jpg'))

  // Attendre l'analyse Gemini (< 10s en E2E avec réseau)
  await expect(page.locator('[data-testid="ingredient-list"]')).toBeVisible({ timeout: 15000 })

  // Vérifier qu'au moins 1 ingrédient détecté
  const ingredients = page.locator('[data-testid="ingredient-item"]')
  const count = await ingredients.count()
  expect(count).toBeGreaterThan(0)

  // Valider et créer la fiche
  await page.fill('[data-testid="dish-nom"]', `Steak E2E ${Date.now()}`)
  await page.click('[data-testid="save-fiche"]')

  // Vérifier redirection vers liste ou fiche
  await page.waitForURL(/\/(plats|plats\/\w+)/, { timeout: 10000 })
})

test('iPhone 14: saisie plat en < 60s', async ({ page }) => {
  const startTime = Date.now()

  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  await page.goto('/plats/nouveau')
  await page.fill('[data-testid="dish-nom"]', 'Steak test mobile')
  await page.click('[data-testid="save-fiche"]')
  await page.waitForURL(/\/(plats)/, { timeout: 10000 })

  expect(Date.now() - startTime).toBeLessThan(60000)
})
```

### Step 2: tests/e2e/commande-full-flow.spec.ts

```typescript
// tests/e2e/commande-full-flow.spec.ts
import { test, expect } from '@playwright/test'

test('flux commande: mercuriale → bon de commande généré', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  // Vérifier mercuriale accessible
  await page.goto('/mercuriale')
  await expect(page.locator('[data-testid="mercuriale-table"]')).toBeVisible()

  // Aller sur commandes
  await page.goto('/commandes')
  await expect(page.locator('[data-testid="commandes-list"]')).toBeVisible()

  // Créer un bon de commande
  await page.click('[data-testid="new-bon-commande"]')
  await expect(page.locator('[data-testid="bon-form"]')).toBeVisible()
})

test('options export: WhatsApp + PDF disponibles', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  // Trouver un bon existant (à adapter selon les fixtures)
  await page.goto('/commandes')
  // Si des bons existent, vérifier les options d'export
  const bons = page.locator('[data-testid^="bon-"]')
  if (await bons.count() > 0) {
    await bons.first().click()
    // Vérifier options d'envoi
    await expect(page.locator('[data-testid="send-whatsapp"]')).toBeVisible()
    await expect(page.locator('[data-testid="send-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="download-pdf"]')).toBeVisible()
  }
})
```

### Step 3: tests/e2e/pms-full-flow.spec.ts

```typescript
// tests/e2e/pms-full-flow.spec.ts
import { test, expect } from '@playwright/test'

test('PMS: saisie température conforme', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  await page.goto('/pms/temperatures')
  await expect(page.locator('[data-testid="temperature-logger"]')).toBeVisible()

  // Saisir une température conforme
  const equipements = page.locator('[data-testid^="equipement-"]')
  if (await equipements.count() > 0) {
    await equipements.first().click()
    await page.fill('[data-testid="temperature-input"]', '3.5')
    await page.click('[data-testid="save-temperature"]')
    await expect(page.locator('[data-testid="badge-conforme"]')).toBeVisible({ timeout: 5000 })
  }
})

test('PMS: température hors plage → alerte rouge visible', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  await page.goto('/pms/temperatures')

  const equipements = page.locator('[data-testid^="equipement-"]')
  if (await equipements.count() > 0) {
    await equipements.first().click()
    await page.fill('[data-testid="temperature-input"]', '7')
    // Alerte doit apparaître avant même de sauvegarder (côté UI)
    await expect(page.locator('[data-testid="alert-hors-plage"]')).toBeVisible({ timeout: 3000 })
  }
})

test('PMS: mode inspecteur → PDF généré', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/)

  await page.goto('/pms/export')

  const startTime = Date.now()
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.click('[data-testid="mode-inspecteur"]')
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  expect(Date.now() - startTime).toBeLessThan(10000) // < 10s
})
```

### Step 4: tests/e2e/rls-isolation.spec.ts

```typescript
// tests/e2e/rls-isolation.spec.ts
import { test, expect, chromium } from '@playwright/test'

test('isolation RLS: compte A ne voit pas données compte B', async () => {
  const browser = await chromium.launch()

  // Contexte A
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await pageA.goto(`${process.env.PLAYWRIGHT_BASE_URL}/login`)
  await pageA.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
  await pageA.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
  await pageA.click('[data-testid="login-submit"]')
  await pageA.waitForURL(/\/dashboard/)

  // Créer un plat avec compte A
  await pageA.goto(`${process.env.PLAYWRIGHT_BASE_URL}/plats/nouveau`)
  const platNom = `RLS Test Plat ${Date.now()}`
  await pageA.fill('[data-testid="dish-nom"]', platNom)
  await pageA.click('[data-testid="save-fiche"]')
  await pageA.waitForURL(/\/plats/)

  // Contexte B (compte différent)
  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await pageB.goto(`${process.env.PLAYWRIGHT_BASE_URL}/login`)
  await pageB.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL_B!)
  await pageB.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD_B!)
  await pageB.click('[data-testid="login-submit"]')
  await pageB.waitForURL(/\/dashboard/)

  // Vérifier que compte B ne voit pas le plat de compte A
  await pageB.goto(`${process.env.PLAYWRIGHT_BASE_URL}/plats`)
  const platContent = await pageB.content()
  expect(platContent).not.toContain(platNom)

  await browser.close()
})
```

### Step 5: Variables d'environnement test E2E

```bash
# .env.test (non committé)
E2E_TEST_EMAIL=beta1@miseenplace.fr
E2E_TEST_PASSWORD=BetaPassword123!
E2E_TEST_EMAIL_B=beta2@miseenplace.fr
E2E_TEST_PASSWORD_B=BetaPassword456!
```

## Files to Create

- `tests/e2e/dish-full-flow.spec.ts`
- `tests/e2e/commande-full-flow.spec.ts`
- `tests/e2e/pms-full-flow.spec.ts`
- `tests/e2e/rls-isolation.spec.ts`
- `.env.test.example` (modèle sans valeurs réelles)

## Files to Modify

- `playwright.config.ts` — s'assurer timeout 30s, retries 2 en CI

## Acceptance Criteria

- [ ] Tous les tests E2E verts sur iPhone 14 (Playwright webkit)
- [ ] Tous les tests E2E verts sur Desktop Chrome
- [ ] Aucun test > 30s (timeout)
- [ ] Tests offline PMS verts (pms-offline.spec.ts)
- [ ] Test isolation RLS: compte A ne voit pas données compte B
- [ ] Screenshots/vidéos des flux clés uploadés comme artifacts CI

## Testing Protocol

### Tous les tests
```bash
# Sur URL production
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" \
  E2E_TEST_EMAIL="beta1@..." \
  E2E_TEST_PASSWORD="..." \
  npx playwright test --project="iPhone 14 Safari"

PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" \
  E2E_TEST_EMAIL="beta1@..." \
  E2E_TEST_PASSWORD="..." \
  npx playwright test --project="Desktop Chrome"
```

### Rapport
```bash
npx playwright show-report
```

## Git

- Branch: `phase-8/beta`
- Commit message prefix: `Task 8.1:`

## PROGRESS.md Update

Marquer Task 8.1 ✅ dans PROGRESS.md.
