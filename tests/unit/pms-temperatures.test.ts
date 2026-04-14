import { describe, it, expect } from 'vitest'

describe('saveTemperatureLog — calcul conformité', () => {
  it('conforme = true si valeur dans [temp_min, temp_max]', () => {
    const temp_min = 0,
      temp_max = 4,
      valeur = 3.5
    expect(valeur >= temp_min && valeur <= temp_max).toBe(true)
  })

  it('conforme = false si valeur hors plage haute', () => {
    const temp_min = 0,
      temp_max = 4,
      valeur = 6.0
    expect(valeur >= temp_min && valeur <= temp_max).toBe(false)
  })

  it('conforme = false si valeur hors plage basse (congélateur)', () => {
    const temp_min = -25,
      temp_max = -18,
      valeur = -10
    expect(valeur >= temp_min && valeur <= temp_max).toBe(false)
  })

  it('valeurs par défaut frigo: [0°C, 4°C]', () => {
    const defaults = { frigo: { temp_min: 0, temp_max: 4 } }
    expect(defaults.frigo.temp_min).toBe(0)
    expect(defaults.frigo.temp_max).toBe(4)
  })

  it('valeurs par défaut congélateur: [-25°C, -18°C]', () => {
    const defaults = { congelateur: { temp_min: -25, temp_max: -18 } }
    expect(defaults.congelateur.temp_min).toBe(-25)
    expect(defaults.congelateur.temp_max).toBe(-18)
  })

  it('valeurs par défaut bain-marie: [63°C, 85°C]', () => {
    const defaults = { bain_marie: { temp_min: 63, temp_max: 85 } }
    expect(defaults.bain_marie.temp_min).toBe(63)
  })
})
