# Task 8.2: Tests Performance

## Objective
Vérification des objectifs de performance définis dans DISCOVERY.md. Dashboard < 1s, recherche ingrédients < 200ms, export PDF < 5s, analyse photo < 5s.

## Context
Tests de performance via Playwright avec Navigation Timing API et chronométrage. Mesures sur URL de production (pas localhost). Les seuils sont stricts — si un seuil échoue, c'est un bug de performance à corriger.

## Dependencies
- Task 8.1 — suite E2E complète opérationnelle

## Blocked By
- Task 8.1

## Implementation Plan

### Step 1: tests/e2e/performance.spec.ts

```typescript
// tests/e2e/performance.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Performance benchmarks', () => {

  test('Dashboard charge en < 1000ms', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    // Mesurer avec Navigation Timing API
    const loadTime = await page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return timing.domContentLoadedEventEnd - timing.startTime
    })

    console.log(`Dashboard load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(1000)
  })

  test('Recherche ingrédients < 200ms', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    await page.goto('/plats/nouveau')

    // Attendre que le composant soit chargé
    await expect(page.locator('[data-testid="ingredient-search"]')).toBeVisible()

    const startTime = Date.now()
    await page.fill('[data-testid="ingredient-search"]', 'beurre')

    // Attendre que les suggestions apparaissent
    await expect(page.locator('[data-testid="ingredient-suggestion"]').first()).toBeVisible({ timeout: 500 })

    const elapsed = Date.now() - startTime
    console.log(`Ingredient search time: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(200)
  })

  test('Export PDF DDPP < 5000ms', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    await page.goto('/pms/export')
    await expect(page.locator('[data-testid="mode-inspecteur"]')).toBeVisible()

    const startTime = Date.now()
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.click('[data-testid="mode-inspecteur"]')
    await downloadPromise

    const elapsed = Date.now() - startTime
    console.log(`PDF export time: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })

  test('Analyse photo plat < 10000ms end-to-end', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    await page.goto('/plats/nouveau')
    await expect(page.locator('[data-testid="dish-camera"]')).toBeVisible()

    const startTime = Date.now()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/dish-steak.jpg'))

    // Attendre les résultats Gemini
    await expect(page.locator('[data-testid="ingredient-list"]')).toBeVisible({ timeout: 15000 })

    const elapsed = Date.now() - startTime
    console.log(`Photo analysis time: ${elapsed}ms`)
    // Objectif < 5s, mais E2E peut être plus lent (réseau réel)
    expect(elapsed).toBeLessThan(10000)
  })

  test('Saisie température < 5s end-to-end', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    await page.goto('/pms/temperatures')

    const equipements = page.locator('[data-testid^="equipement-"]')
    if (await equipements.count() === 0) {
      test.skip()
      return
    }

    const startTime = Date.now()
    await equipements.first().click()
    await page.fill('[data-testid="temperature-input"]', '3.5')
    await page.click('[data-testid="save-temperature"]')
    await expect(page.locator('[data-testid="badge-conforme"]')).toBeVisible({ timeout: 5000 })

    const elapsed = Date.now() - startTime
    console.log(`Temperature input time: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })

  test('LCP (Largest Contentful Paint) < 2500ms', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    // Mesurer LCP via Performance Observer
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1]
          resolve(lastEntry.startTime)
        }).observe({ type: 'largest-contentful-paint', buffered: true })

        setTimeout(() => resolve(9999), 5000)
      })
    })

    console.log(`LCP: ${lcp}ms`)
    expect(lcp).toBeLessThan(2500) // Core Web Vitals "Good" threshold
  })
})
```

### Step 2: Seuils de performance (référence DISCOVERY.md)

| Métrique | Objectif | Test E2E seuil |
|---|---|---|
| Dashboard load | < 1s | < 1000ms |
| Recherche ingrédients | < 200ms | < 200ms |
| Analyse photo (Gemini) | < 3s (prod optimisée) | < 10s (E2E réseau réel) |
| Export PDF DDPP | < 5s | < 5000ms |
| Saisie température | < 5s end-to-end | < 5000ms |
| LCP | < 2.5s (Core Web Vitals Good) | < 2500ms |

### Step 3: Script de benchmark CI

```yaml
# À ajouter dans .github/workflows/ci.yml dans le job e2e-tests:
- name: Run performance tests
  run: npx playwright test tests/e2e/performance.spec.ts --project="Desktop Chrome"
  env:
    PLAYWRIGHT_BASE_URL: ${{ needs.deploy-preview.outputs.preview_url }}
    E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
```

## Files to Create

- `tests/e2e/performance.spec.ts`

## Files to Modify

- `.github/workflows/ci.yml` — ajouter performance tests dans job e2e

## Acceptance Criteria

- [ ] Dashboard < 1s (Navigation Timing API)
- [ ] Recherche ingrédients < 200ms (Playwright)
- [ ] Export PDF < 5s (Playwright network timing)
- [ ] Analyse photo < 10s end-to-end (réseau réel E2E)
- [ ] Saisie température < 5s end-to-end
- [ ] LCP < 2500ms (Core Web Vitals Good)

## Testing Protocol

```bash
# Sur URL production
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" \
  E2E_TEST_EMAIL="beta1@..." \
  E2E_TEST_PASSWORD="..." \
  npx playwright test tests/e2e/performance.spec.ts --project="Desktop Chrome"

# Sur iPhone 14
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" \
  E2E_TEST_EMAIL="beta1@..." \
  E2E_TEST_PASSWORD="..." \
  npx playwright test tests/e2e/performance.spec.ts --project="iPhone 14 Safari"
```

### Si un seuil échoue

1. Identifier la requête lente (Playwright Network tab)
2. Vérifier: requêtes en parallèle (Promise.all) vs séquentielles
3. Vérifier: index BDD manquants
4. Vérifier: bundle JS trop lourd (Next.js analyze bundle)
5. Corriger avant de marquer la task terminée

## Git

- Branch: `phase-8/beta`
- Commit message prefix: `Task 8.2:`

## PROGRESS.md Update

Marquer Task 8.2 ✅ dans PROGRESS.md.
