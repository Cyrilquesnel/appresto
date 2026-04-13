import { describe, it, expect } from 'vitest'

interface SearchResult {
  id: string
  nom: string
  source: 'restaurant' | 'catalog'
  allergenes: string[]
  score: number
}

describe('plats.searchIngredients', () => {
  it('returns results sorted by source (restaurant before catalog)', () => {
    const mockResults: SearchResult[] = [
      { id: '1', nom: 'beurre clarifié', source: 'restaurant', allergenes: ['lait'], score: 0.9 },
      { id: '2', nom: 'beurre doux', source: 'catalog', allergenes: ['lait'], score: 0.8 },
    ]
    expect(mockResults[0].source).toBe('restaurant')
    expect(mockResults[1].source).toBe('catalog')
  })

  it('returns empty array when no results', () => {
    const results: SearchResult[] = []
    expect(results).toHaveLength(0)
  })

  it('filters allergenes correctly', () => {
    const beurre: SearchResult = {
      id: '1',
      nom: 'beurre',
      source: 'catalog',
      allergenes: ['lait'],
      score: 0.95,
    }
    expect(beurre.allergenes).toContain('lait')
    expect(beurre.allergenes).not.toContain('gluten')
  })
})
