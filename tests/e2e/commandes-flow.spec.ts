import { test, expect } from '@playwright/test'

test.describe('Flux Commandes', () => {
  test.skip(
    !process.env.PLAYWRIGHT_AUTHED,
    'Requiert utilisateur authentifié (PLAYWRIGHT_AUTHED=1)'
  )

  test('liste commandes accessible', async ({ page }) => {
    await page.goto('/commandes')
    await expect(page.locator('h1, [data-testid="commandes-title"]')).toBeVisible()
  })

  test('création nouveau bon de commande', async ({ page }) => {
    await page.goto('/commandes/nouveau')
    await expect(page.locator('[data-testid="fournisseur-select"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('preview bon de commande avec au moins 1 ligne', async ({ page }) => {
    await page.goto('/commandes/nouveau')
    await page.locator('[data-testid="fournisseur-select"]').selectOption({ index: 1 })
    await page.click('[data-testid="add-ligne"]')
    await expect(page.locator('[data-testid="bon-preview"]')).toBeVisible({ timeout: 5000 })
  })
})
