import { vi } from 'vitest'

export const mockGeminiResult = {
  type_plat: 'Viande grillée',
  ingredients_detectes: [
    { nom: 'bœuf', categorie: 'viande', visible: true, confiance: 0.95, grammage_suggere: 180 },
    {
      nom: 'haricots verts',
      categorie: 'legume',
      visible: true,
      confiance: 0.88,
      grammage_suggere: 80,
    },
    {
      nom: 'pommes de terre',
      categorie: 'legume',
      visible: true,
      confiance: 0.92,
      grammage_suggere: 150,
    },
  ],
  confiance_globale: 0.91,
  remarques: 'Plat principal avec accompagnements',
}

vi.mock('@/lib/ai/gemini', () => ({
  analyzeDishPhoto: vi.fn().mockResolvedValue(mockGeminiResult),
  analyzeWithRetry: vi.fn().mockResolvedValue(mockGeminiResult),
}))
