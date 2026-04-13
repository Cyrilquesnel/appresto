import { test, expect } from '@playwright/test'

test('Service Worker enregistré sur la page principale', async ({ page }) => {
  await page.goto('/')
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg !== null
  })
  expect(swReady).toBe(true)
})

test('mode offline: badge offline visible quand réseau coupé', async ({ page, context }) => {
  await page.goto('/pms/temperatures')
  await context.setOffline(true)

  // Recharger pour déclencher la détection offline
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))

  // Vérifier badge visible
  await expect(page.locator('[data-testid="offline-badge"]')).toBeVisible({ timeout: 3000 })

  await context.setOffline(false)
})
