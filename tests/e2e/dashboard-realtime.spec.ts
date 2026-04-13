import { test, expect } from '@playwright/test'

test('dashboard mis à jour quand ventes saisies dans un autre onglet', async ({ browser }) => {
  const page1 = await browser.newPage()
  await page1.goto('/dashboard')
  const initialCA = await page1.locator('[data-testid="ca-value"]').textContent()

  const page2 = await browser.newPage()
  await page2.goto('/dashboard/saisie-ventes')
  await page2.fill('[data-testid="ventes-couverts"]', '10')
  await page2.fill('[data-testid="ventes-panier"]', '30')
  await page2.click('[data-testid="save-ventes-button"]')
  await page2.waitForSelector('text=Ventes enregistrées')

  await page1.waitForFunction(
    (oldCA) => document.querySelector('[data-testid="ca-value"]')?.textContent !== oldCA,
    initialCA,
    { timeout: 3000 }
  )

  const newCA = await page1.locator('[data-testid="ca-value"]').textContent()
  expect(newCA).not.toBe(initialCA)
})
