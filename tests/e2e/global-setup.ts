// tests/e2e/global-setup.ts
// Crée une session authentifiée réutilisée par tous les tests E2E authed.
// Exécuté une seule fois avant la suite (globalSetup dans playwright.config.ts).
// En CI sans PLAYWRIGHT_TEST_EMAIL, le setup est un no-op (tests skippés côté spec).

import { chromium, FullConfig } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

export const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (!email || !password) {
    // Pas de credentials — tests authed seront skippés individuellement
    return
  }

  // Créer le dossier .auth si nécessaire
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? _config.projects[0].use.baseURL ?? 'http://localhost:3000'

  await page.goto(`${baseURL}/login`)
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await page.click('button[type=submit]')

  // Attendre la redirection post-login
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })

  // Sauvegarder le state (cookies + localStorage Supabase)
  await page.context().storageState({ path: AUTH_FILE })

  await browser.close()
}
