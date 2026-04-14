// tests/e2e/mercuriale.spec.ts
// Flow achat : fournisseurs + mercuriale + bon de commande

import { test, expect } from './fixtures'

test.describe('Module Acheter — Mercuriale', () => {
  test('page fournisseurs accessible', async ({ authedPage: page }) => {
    await page.goto('/mercuriale/fournisseurs')
    await expect(page).toHaveURL(/fournisseurs/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page mercuriale accessible', async ({ authedPage: page }) => {
    await page.goto('/mercuriale')
    await expect(page).toHaveURL(/mercuriale/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page nouvelle commande accessible', async ({ authedPage: page }) => {
    await page.goto('/commandes/nouveau')
    await expect(page).toHaveURL(/commandes\/nouveau/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('liste des commandes accessible', async ({ authedPage: page }) => {
    await page.goto('/commandes')
    await expect(page).toHaveURL(/commandes/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })
})
