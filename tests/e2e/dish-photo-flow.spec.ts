import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Flux Photo Plat (Gemini)', () => {
  test.skip(
    !process.env.PLAYWRIGHT_AUTHED,
    'Requiert utilisateur authentifié (PLAYWRIGHT_AUTHED=1)'
  )

  test('upload photo → analyse → validation ingrédients', async ({ page }) => {
    await page.goto('/plats/nouveau')

    const fixturePath = path.resolve(__dirname, '../fixtures/dish-steak.jpg')
    await page.setInputFiles('input[type=file]', fixturePath)

    await expect(page.locator('[data-testid="dish-analysis-loading"]')).toBeVisible({
      timeout: 5000,
    })

    await expect(page.locator('[data-testid="ingredients-list"]')).toBeVisible({
      timeout: 30000,
    })

    const ingredients = page.locator('[data-testid="ingredient-item"]')
    expect(await ingredients.count()).toBeGreaterThan(0)

    await page.click('[data-testid="validate-ingredients"]')
    await expect(page.locator('[data-testid="fiche-technique-form"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('erreur réseau → message utilisateur', async ({ page }) => {
    await page.route('**/api/analyze-dish', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'server-error' }) })
    )

    await page.goto('/plats/nouveau')
    const fixturePath = path.resolve(__dirname, '../fixtures/dish-steak.jpg')
    await page.setInputFiles('input[type=file]', fixturePath)

    await expect(page.locator('[data-testid="dish-analysis-error"]')).toBeVisible({
      timeout: 10000,
    })
  })
})
