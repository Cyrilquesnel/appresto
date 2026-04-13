import { test, expect } from '@playwright/test'

test('manifest.json accessible et valide', async ({ page }) => {
  const response = await page.request.get('/manifest.json')
  expect(response.status()).toBe(200)

  const manifest = await response.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.name).toBe('Mise en Place')
  expect(manifest.share_target).toBeDefined()
  expect(manifest.icons.length).toBeGreaterThan(0)
  expect(manifest.start_url).toBe('/dashboard')
})

test('meta tags iOS présents', async ({ page }) => {
  await page.goto('/')
  const appleCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')
  expect(appleCapable).toBe('yes')
})

test('link manifest présent dans le head', async ({ page }) => {
  await page.goto('/')
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBe('/manifest.json')
})

test('apple-touch-icon présent', async ({ page }) => {
  await page.goto('/')
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect(icon).toBe('/icons/icon-192.png')
})
