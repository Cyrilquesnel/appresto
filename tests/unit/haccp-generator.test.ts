import { describe, it, expect, vi } from 'vitest'

const mockCreate = vi.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: JSON.stringify([{
      plat_nom: 'Poulet rôti',
      danger: 'Contamination Salmonella',
      etape_critique: 'Cuisson',
      ccp_numero: 'CCP-1',
      temperature_critique: 74,
      limite_critique: '74°C minimum pendant 2 minutes',
      mesure_surveillance: 'Sonde de température cœur',
      action_corrective: 'Poursuivre la cuisson',
      verification: 'Calibration mensuelle sonde',
    }]),
  }],
})

class MockAnthropic {
  messages = { create: mockCreate }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}))

describe('generateHACCPPlan', () => {
  it('génère des points HACCP pour un plat avec volaille', async () => {
    const { generateHACCPPlan } = await import('@/lib/ai/haccp-generator')
    const plats = [{
      id: 'test-id',
      nom: 'Poulet rôti',
      ingredients: [{ nom: 'poulet', allergenes: [] }],
      type_plat: 'Viande',
    }]
    const points = await generateHACCPPlan(plats)
    expect(points).toHaveLength(1)
    expect(points[0].temperature_critique).toBe(74)
    expect(points[0].ccp_numero).toBe('CCP-1')
  })

  it('lie le point au plat via plat_id', async () => {
    const { generateHACCPPlan } = await import('@/lib/ai/haccp-generator')
    const plats = [{
      id: 'uuid-poulet',
      nom: 'Poulet rôti',
      ingredients: [{ nom: 'poulet', allergenes: [] }],
      type_plat: null,
    }]
    const points = await generateHACCPPlan(plats)
    expect(points[0].plat_id).toBe('uuid-poulet')
  })
})
