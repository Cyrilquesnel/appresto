import { test, expect } from '@playwright/test'

test.describe('Authentification', () => {
  test('redirection vers /login quand non authentifié', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('formulaire login affiche email + password', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[name=email]')).toBeVisible()
    await expect(page.locator('input[name=password]')).toBeVisible()
    await expect(page.locator('button[type=submit]')).toBeVisible()
  })

  test('formulaire register accessible depuis login', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[name=email]')).toBeVisible()
    await expect(page.locator('input[name=password]')).toBeVisible()
  })

  test('soumission login avec credentials invalides affiche erreur', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name=email]', 'invalid@example.com')
    await page.fill('input[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')
    await expect(page.locator('[role=alert], .error, [data-testid="login-error"]')).toBeVisible({
      timeout: 10000,
    })
  })
})
