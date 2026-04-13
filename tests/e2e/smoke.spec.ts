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
