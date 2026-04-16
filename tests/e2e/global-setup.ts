// tests/e2e/global-setup.ts
// Crée une session authentifiée réutilisée par tous les tests E2E authed.
// Exécuté une seule fois avant la suite (globalSetup dans playwright.config.ts).
// En local : lit les credentials depuis .env.test (généré par scripts/seed-test-restaurant.js)
// En CI : utilise PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD

import { chromium, FullConfig } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// Charger .env.test en local si présent
const envTestPath = path.join(__dirname, '..', '..', '.env.test')
if (fs.existsSync(envTestPath)) {
  const lines = fs.readFileSync(envTestPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

export const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL ?? process.env.TEST_E2E_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.TEST_E2E_PASSWORD

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
