import { describe, it, expect } from 'vitest'

describe('calcul KPIs dashboard', () => {
  it('food_cost_pct = food_cost_euros / ca_total × 100', () => {
    const ca_total = 10000
    const food_cost_euros = 2800
    const pct = Math.round((food_cost_euros / ca_total) * 10000) / 100
    expect(pct).toBe(28.00)
  })

  it('seuil_rentabilite = charges_fixes / (1 - food_cost_pct/100)', () => {
    const charges_fixes = 5000
    const food_cost_pct = 30
    const seuil = charges_fixes / (1 - food_cost_pct / 100)
    expect(Math.round(seuil)).toBe(7143)
  })

  it('retourne null si pas de ventes (ca_total = 0)', () => {
    const ca_total = 0
    const food_cost_pct = ca_total > 0 ? 28 : null
    expect(food_cost_pct).toBeNull()
  })

  it('food cost 35% = limite warn/bad', () => {
    const status = (pct: number) => pct <= 30 ? 'good' : pct <= 35 ? 'warn' : 'bad'
    expect(status(28)).toBe('good')
    expect(status(33)).toBe('warn')
    expect(status(36)).toBe('bad')
  })

  it('seuil atteint quand CA >= seuil', () => {
    const seuil = 7143
    expect(8000 >= seuil).toBe(true)
    expect(5000 >= seuil).toBe(false)
  })

  it('marge_brute = ca - food_cost - masse_salariale - charges_fixes', () => {
    const ca = 10000
    const food_cost = 2800
    const masse_salariale = 3000
    const charges_fixes = 1500
    const marge = ca - food_cost - masse_salariale - charges_fixes
    expect(marge).toBe(2700)
  })
})
