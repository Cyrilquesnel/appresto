// tests/e2e/security-headers.spec.ts
// Vérifie les security headers injectés par vercel.json en production.
// En local (next dev) ces headers ne sont pas appliqués — les tests passent
// en vérifiant uniquement les statuts HTTP. En production, les assertions
// headers sont actives via PLAYWRIGHT_CHECK_HEADERS=1.

import { test, expect } from '@playwright/test'

const CHECK_HEADERS = !!process.env.PLAYWRIGHT_CHECK_HEADERS

test.describe('Security Headers', () => {
  test('HSTS présent en production', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/')
    const hsts = response.headers()['strict-transport-security']
    expect(hsts).toBeDefined()
    expect(hsts).toContain('max-age=63072000')
    expect(hsts).toContain('includeSubDomains')
  })

  test('X-Frame-Options DENY', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/login')
    expect(response.headers()['x-frame-options']).toBe('DENY')
  })

  test('X-Content-Type-Options nosniff', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/login')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
  })

  test('Referrer-Policy strict-origin-when-cross-origin', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/login')
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('Permissions-Policy autorise caméra (self)', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/login')
    const pp = response.headers()['permissions-policy']
    expect(pp).toBeDefined()
    expect(pp).toContain('camera=(self)')
    expect(pp).toContain('microphone=()')
  })

  test('API /api/health : Cache-Control no-store', async ({ request }) => {
    test.skip(!CHECK_HEADERS, 'Headers vérifiés uniquement avec PLAYWRIGHT_CHECK_HEADERS=1')

    const response = await request.get('/api/health')
    const cc = response.headers()['cache-control']
    expect(cc).toContain('no-store')
  })
})

test.describe('Sécurité API', () => {
  test('/api/health ne retourne pas de données sensibles', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const body = await response.json()
    // Vérifier l'absence de données sensibles dans la réponse
    const bodyStr = JSON.stringify(body)
    expect(bodyStr).not.toContain('password')
    expect(bodyStr).not.toContain('secret')
    expect(bodyStr).not.toContain('token')
    expect(bodyStr).not.toContain('key')
  })

  test('routes /api/cron/* rejettent sans Bearer token', async ({ request }) => {
    const routes = [
      '/api/cron/rappelconso',
      '/api/cron/temperature-reminders',
      '/api/cron/onboarding-notifications',
    ]

    for (const route of routes) {
      const response = await request.get(route)
      expect(response.status(), `${route} devrait retourner 401 sans auth`).toBe(401)
    }
  })

  test('routes /api/cron/* rejettent avec mauvais token', async ({ request }) => {
    const response = await request.get('/api/cron/rappelconso', {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(response.status()).toBe(401)
  })
})
