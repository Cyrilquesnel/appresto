// tests/e2e/pms-temperatures.spec.ts
// Module PMS : températures, checklists, réceptions, HACCP, rappels

import { test, expect } from './fixtures'

test.describe('Module PMS', () => {
  test('page températures accessible', async ({ authedPage: page }) => {
    await page.goto('/pms/temperatures')
    await expect(page).toHaveURL(/pms\/temperatures/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page checklists nettoyage accessible', async ({ authedPage: page }) => {
    await page.goto('/pms/checklists')
    await expect(page).toHaveURL(/pms\/checklists/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page réceptions marchandises accessible', async ({ authedPage: page }) => {
    await page.goto('/pms/receptions')
    await expect(page).toHaveURL(/pms\/receptions/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page HACCP accessible', async ({ authedPage: page }) => {
    await page.goto('/pms/haccp')
    await expect(page).toHaveURL(/pms\/haccp/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page rappels alertes accessible', async ({ authedPage: page }) => {
    await page.goto('/pms/rappels')
    await expect(page).toHaveURL(/pms\/rappels/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('page PMS overview accessible', async ({ authedPage: page }) => {
    await page.goto('/pms')
    await expect(page).toHaveURL(/\/pms/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })
})
