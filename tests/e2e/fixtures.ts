// tests/e2e/fixtures.ts
// Fixture "authedPage" : page avec session active (storageState).
// Si AUTH_FILE absent (pas de credentials CI), le test est skipé automatiquement.

import { test as base, expect } from '@playwright/test'
import * as fs from 'fs'
import { AUTH_FILE } from './global-setup'

type AuthFixtures = {
  authedPage: Awaited<ReturnType<(typeof base)['extend']>> extends { authedPage: infer P }
    ? P
    : never
}

export const test = base.extend<{ authedPage: import('@playwright/test').Page }>({
  authedPage: async ({ browser }, use) => {
    if (!fs.existsSync(AUTH_FILE)) {
      // Pas de session — skip proprement
      test.skip(true, 'Auth state non disponible (PLAYWRIGHT_TEST_EMAIL non défini)')
      return
    }
    const context = await browser.newContext({ storageState: AUTH_FILE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect }
