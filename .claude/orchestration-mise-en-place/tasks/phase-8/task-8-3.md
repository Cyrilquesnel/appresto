# Task 8.3: Validation RLS + Sécurité Finale

## Objective
Vérification finale de l'isolation des données et de la sécurité — aucune fuite inter-restaurant possible. Aucune variable sensible côté client.

## Context
Dernière ligne de défense avant la beta. Test avec 2 contextes browser indépendants. La RLS Supabase est "silencieuse" — 0 résultats (pas 401) pour les données d'un autre restaurant. Vérification que SUPABASE_SERVICE_ROLE_KEY n'est jamais exposé en NEXT_PUBLIC_*.

## Dependencies
- Task 7.4 — pgTAP RLS complets

## Blocked By
- Task 7.4

## Implementation Plan

### Step 1: tests/e2e/rls-isolation.spec.ts (version complète)

```typescript
// tests/e2e/rls-isolation.spec.ts
import { test, expect, chromium, BrowserContext } from '@playwright/test'

async function loginAs(
  context: BrowserContext,
  email: string,
  password: string,
  baseURL: string
) {
  const page = await context.newPage()
  await page.goto(`${baseURL}/login`)
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', password)
  await page.click('[data-testid="login-submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  return page
}

test.describe('Isolation RLS inter-restaurant', () => {
  test('Compte A ne voit pas les plats de compte B', async () => {
    const browser = await chromium.launch()
    const baseURL = process.env.PLAYWRIGHT_BASE_URL!

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await loginAs(contextA, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, baseURL)
    const pageB = await loginAs(contextB, process.env.E2E_TEST_EMAIL_B!, process.env.E2E_TEST_PASSWORD_B!, baseURL)

    // Compte A crée un plat avec un nom unique
    const uniqueName = `RLS-Test-${Date.now()}`
    await pageA.goto(`${baseURL}/plats/nouveau`)
    await pageA.fill('[data-testid="dish-nom"]', uniqueName)
    await pageA.click('[data-testid="save-fiche"]')
    await pageA.waitForURL(/\/plats/, { timeout: 10000 })

    // Vérifier compte A voit son plat
    await pageA.goto(`${baseURL}/plats`)
    await expect(pageA.locator(`text="${uniqueName}"`)).toBeVisible()

    // Compte B ne doit PAS voir le plat de A
    await pageB.goto(`${baseURL}/plats`)
    const pageBContent = await pageB.content()
    expect(pageBContent).not.toContain(uniqueName)

    await browser.close()
  })

  test('Compte B ne voit pas les données PMS de compte A', async () => {
    const browser = await chromium.launch()
    const baseURL = process.env.PLAYWRIGHT_BASE_URL!

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await loginAs(contextA, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, baseURL)
    const pageB = await loginAs(contextB, process.env.E2E_TEST_EMAIL_B!, process.env.E2E_TEST_PASSWORD_B!, baseURL)

    // Vérifier que les données PMS de A ne sont pas dans B
    await pageA.goto(`${baseURL}/pms/temperatures`)
    const pageBPMS = await pageB.goto(`${baseURL}/pms/temperatures`)

    // B doit voir sa propre page (pas d'erreur 500)
    expect(pageBPMS?.status()).toBe(200)

    // Les équipements de A ne doivent pas apparaître chez B (vérification par API)
    const responseA = await pageA.evaluate(async () => {
      const res = await fetch('/api/trpc/pms.getEquipements')
      return res.json()
    })
    const responseB = await pageB.evaluate(async () => {
      const res = await fetch('/api/trpc/pms.getEquipements')
      return res.json()
    })

    // Les listes ne doivent pas se chevaucher
    const idsA = responseA?.result?.data?.map((e: any) => e.id) ?? []
    const idsB = responseB?.result?.data?.map((e: any) => e.id) ?? []
    const overlap = idsA.filter((id: string) => idsB.includes(id))
    expect(overlap).toHaveLength(0)

    await browser.close()
  })

  test('Accès direct UUID autre restaurant → 0 résultats (RLS silencieux)', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[data-testid="password"]', process.env.E2E_TEST_PASSWORD!)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL(/\/dashboard/)

    // Tenter d'accéder à un UUID aléatoire (simulant un ID d'un autre restaurant)
    const fakeRestaurantId = '00000000-0000-0000-0000-000000000001'
    const response = await page.evaluate(async (id) => {
      const res = await fetch(`/api/trpc/plats.list?input=${JSON.stringify({ restaurantId: id })}`)
      return res.json()
    }, fakeRestaurantId)

    // RLS: 0 résultats (pas d'erreur 401 ou 403 — données simplement vides)
    expect(response?.result?.data ?? []).toHaveLength(0)
  })
})
```

### Step 2: Vérification variables d'environnement

```typescript
// tests/security/env-check.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { glob } from 'glob'

describe('Sécurité — variables environnement', () => {
  it('SUPABASE_SERVICE_ROLE_KEY ne doit jamais être dans NEXT_PUBLIC_*', async () => {
    const files = await glob('**/*.{ts,tsx,js}', {
      ignore: ['node_modules/**', '.next/**', 'tests/**'],
    })

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      expect(content).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/)
      expect(content).not.toMatch(/NEXT_PUBLIC_ANTHROPIC_API_KEY/)
      expect(content).not.toMatch(/NEXT_PUBLIC_GEMINI_API_KEY/)
      expect(content).not.toMatch(/NEXT_PUBLIC_CRON_SECRET/)
      expect(content).not.toMatch(/NEXT_PUBLIC_VAPID_PRIVATE_KEY/)
    }
  })

  it('Pas de hardcoded API keys dans le code source', async () => {
    const files = await glob('**/*.{ts,tsx,js}', {
      ignore: ['node_modules/**', '.next/**', 'tests/**'],
    })

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Détecter patterns de clés hardcodées
      expect(content).not.toMatch(/sk-ant-api\d{2}-/)  // Anthropic keys
      expect(content).not.toMatch(/AIzaSy[A-Za-z0-9_-]{33}/)  // Google API keys
      expect(content).not.toMatch(/re_[A-Za-z0-9]{24}/)  // Resend keys
    }
  })
})
```

### Step 3: Checklist sécurité finale

```
□ RLS activée sur TOUTES les tables (vérifier avec \d+ en psql)
□ Aucune route API sans authentification (sauf /api/health, /api/stripe/webhook)
□ CRON_SECRET: 32+ caractères aléatoires
□ SUPABASE_SERVICE_ROLE_KEY: uniquement côté serveur (server/ et lib/supabase/server.ts)
□ Supabase anon key: uniquement pour les opérations publiques (auth)
□ Pas de console.log avec données utilisateur en production
□ Sentry maskAllText: true
□ PostHog: pas de PII dans les events
```

### Step 4: Vérification psql — RLS sur toutes les tables

```bash
# Vérifier que RLS est activé sur toutes les tables métier
psql $DATABASE_URL -c "
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
# rowsecurity doit être 't' pour TOUTES les tables métier
# (restaurants, plats, fiches_technique, mercuriale, bons_de_commande, ventes,
#  temperature_logs, nettoyage_completions, receptions, rappel_alerts, events, etc.)
```

## Files to Create

- `tests/e2e/rls-isolation.spec.ts` (version complète — remplace la version basique de task 8.1)
- `tests/security/env-check.test.ts`

## Files to Modify

- Aucun code source — tests uniquement

## Acceptance Criteria

- [ ] Compte A ne peut pas accéder aux données de compte B (Playwright — 2 contextes)
- [ ] Accès direct UUID aléatoire → 0 résultats (RLS silencieux, pas 401)
- [ ] `supabase test db` → 100% pgTAP verts
- [ ] Aucune variable sensible exposée côté client (`NEXT_PUBLIC_*` audit)
- [ ] Pas de clé API hardcodée dans le code source
- [ ] RLS activée sur toutes les tables publiques (psql check)

## Testing Protocol

### Playwright isolation
```bash
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" \
  E2E_TEST_EMAIL="beta1@..." \
  E2E_TEST_PASSWORD="..." \
  E2E_TEST_EMAIL_B="beta2@..." \
  E2E_TEST_PASSWORD_B="..." \
  npx playwright test tests/e2e/rls-isolation.spec.ts
```

### pgTAP
```bash
supabase test db
```

### Audit sécurité
```bash
npm run test:unit -- env-check
grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE" --include="*.ts" --include="*.tsx" .
grep -r "sk-ant-api" --include="*.ts" --include="*.tsx" .
```

## Git

- Branch: `phase-8/beta`
- Commit message prefix: `Task 8.3:`

## PROGRESS.md Update

Marquer Task 8.3 ✅ dans PROGRESS.md.
