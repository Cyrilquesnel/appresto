import { describe, it, expect, vi } from 'vitest'

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        bœuf: {
          allergenes_confirmes: [],
          grammage_portion: 180,
          kcal_par_100g: 250,
          unite_standard: 'g',
        },
      }),
    },
  ],
})

// Mock Anthropic avec une classe constructable
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

describe('shouldEnrich', () => {
  it('retourne true si confiance_globale < 0.55', async () => {
    const { shouldEnrich } = await import('@/lib/ai/claude-enrichment')
    expect(shouldEnrich(0.5, [0.8, 0.9])).toBe(true)
  })

  it('retourne true si un ingrédient a confiance < 0.55', async () => {
    const { shouldEnrich } = await import('@/lib/ai/claude-enrichment')
    expect(shouldEnrich(0.8, [0.9, 0.4, 0.85])).toBe(true)
  })

  it('retourne false si tout est >= 0.55', async () => {
    const { shouldEnrich } = await import('@/lib/ai/claude-enrichment')
    expect(shouldEnrich(0.9, [0.8, 0.85, 0.95])).toBe(false)
  })

  it('retourne false si confiance exactement à 0.55', async () => {
    const { shouldEnrich } = await import('@/lib/ai/claude-enrichment')
    expect(shouldEnrich(0.55, [0.55, 0.7])).toBe(false)
  })
})

describe('enrichIngredients', () => {
  it('retourne un objet vide si aucun ingrédient', async () => {
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    const result = await enrichIngredients([])
    expect(result).toEqual({})
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retourne résultat enrichi pour un ingrédient', async () => {
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    const result = await enrichIngredients(['bœuf'])
    expect(result['bœuf']).toBeDefined()
    expect(result['bœuf'].allergenes_confirmes).toBeInstanceOf(Array)
    expect(result['bœuf'].grammage_portion).toBe(180)
  })

  it('retourne objet vide sur timeout (dégradé gracieux)', async () => {
    // Forcer un délai de 50ms pour que le timeout de 1ms se déclenche avant la réponse
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                content: [{ type: 'text', text: '{}' }],
              }),
            50
          )
        )
    )
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    const result = await enrichIngredients(['bœuf'], 1)
    expect(result).toEqual({})
  })

  it('vérifie que cache_control ephemeral est configuré', async () => {
    mockCreate.mockClear()
    const { enrichIngredients } = await import('@/lib/ai/claude-enrichment')
    await enrichIngredients(['poulet'])
    expect(mockCreate).toHaveBeenCalled()
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})
