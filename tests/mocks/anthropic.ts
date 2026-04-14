import { vi } from 'vitest'

export const mockClaudeEnrichment = {
  bœuf: {
    allergenes_confirmes: [],
    grammage_portion: 180,
    kcal_par_100g: 250,
    unite_standard: 'g',
    notes: 'Viande bovine, cuisson à 63°C minimum',
  },
}

vi.mock('@/lib/ai/claude-enrichment', () => ({
  enrichIngredients: vi.fn().mockResolvedValue(mockClaudeEnrichment),
}))
