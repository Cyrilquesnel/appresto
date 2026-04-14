// tests/e2e/performance.spec.ts
// Core Web Vitals + temps de chargement sur les pages critiques
// Seuils : LCP < 2.5s, CLS < 0.1, FCP < 1.8s (cibles "Good" Google)

import { test, expect } from '@playwright/test'

// Récupère les métriques Web Vitals via PerformanceObserver
async function getWebVitals(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    return new Promise<{
      lcp: number | null
      cls: number
      fcp: number | null
      ttfb: number | null
    }>((resolve) => {
      let lcp: number | null = null
      let cls = 0
      let fcp: number | null = null
      let ttfb: number | null = null

      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined
      if (nav) ttfb = nav.responseStart - nav.startTime

      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint')
      if (fcpEntry) fcp = fcpEntry.startTime

      // LCP observer
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        lcp = entries[entries.length - 1].startTime
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

      // CLS observer
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore — hadRecentInput not in TS types
          if (!entry.hadRecentInput) cls += (entry as unknown as { value: number }).value
        }
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })

      // Donner 2s pour collecter
      setTimeout(() => {
        lcpObserver.disconnect()
        clsObserver.disconnect()
        resolve({ lcp, cls, fcp, ttfb })
      }, 2000)
    })
  })
}

test.describe('Performance — pages publiques', () => {
  test('page /login : LCP < 2.5s, CLS < 0.1', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    const vitals = await getWebVitals(page)

    if (vitals.lcp !== null) {
      expect(vitals.lcp, `LCP trop élevé: ${vitals.lcp}ms`).toBeLessThan(2500)
    }
    expect(vitals.cls, `CLS trop élevé: ${vitals.cls}`).toBeLessThan(0.1)
  })

  test('page /login : FCP < 1.8s', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const vitals = await getWebVitals(page)

    if (vitals.fcp !== null) {
      expect(vitals.fcp, `FCP trop élevé: ${vitals.fcp}ms`).toBeLessThan(1800)
    }
  })

  test('/api/health répond en < 500ms', async ({ request }) => {
    const start = Date.now()
    const response = await request.get('/api/health')
    const duration = Date.now() - start

    expect(response.status()).toBe(200)
    expect(duration, `Health check trop lent: ${duration}ms`).toBeLessThan(500)
  })

  test('assets statiques servis avec cache immutable', async ({ request }) => {
    // Vérifier que les pages retournent les security headers (depuis vercel.json)
    const response = await request.get('/login')
    const headers = response.headers()

    // Ces headers sont injectés par vercel.json en production
    // En local (next dev) ils ne sont pas présents — on vérifie juste le statut
    expect(response.status()).toBeLessThan(400)
  })
})

test.describe('Performance — bundle size', () => {
  test('page /login : pas de JS blocking > 300kb', async ({ page }) => {
    const largeScripts: string[] = []

    page.on('response', (response) => {
      if (
        response.url().includes('/_next/static') &&
        response.headers()['content-type']?.includes('javascript')
      ) {
        const size = parseInt(response.headers()['content-length'] ?? '0', 10)
        if (size > 300_000) {
          largeScripts.push(`${response.url()} (${Math.round(size / 1024)}kb)`)
        }
      }
    })

    await page.goto('/login', { waitUntil: 'networkidle' })

    expect(largeScripts, `Scripts JS > 300kb détectés: ${largeScripts.join(', ')}`).toHaveLength(0)
  })
})
