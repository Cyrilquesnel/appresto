import { test, expect } from '@playwright/test'

test('onboarding J1 complet en < 2 minutes', async ({ page }) => {
  const startTime = Date.now()

  await page.goto('/onboarding')
  await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible()

  await page.click('[data-testid="type-restaurant"]')
  await page.click('[data-testid="continue-onboarding"]')

  await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible({ timeout: 5000 })
  await page.click('[data-testid="skip-photo"]')

  await expect(page.locator('[data-testid="onboarding-done"]')).toBeVisible({ timeout: 5000 })
  await page.waitForURL(/\/dashboard/, { timeout: 5000 })

  const elapsed = Date.now() - startTime
  expect(elapsed).toBeLessThan(120_000)
})

test('OnboardingProgress visible sur dashboard si non complété', async ({ page }) => {
  await page.goto('/dashboard')
  // Le composant est rendu côté client — timeout tolérant
  await expect(page.locator('[data-testid="onboarding-progress"]')).toBeVisible({ timeout: 5000 })
})
