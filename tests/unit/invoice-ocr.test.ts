import { describe, it, expect } from 'vitest'
import { matchIngredient } from '@/lib/ai/invoice-ocr'

const ingredients = [
  { id: '1', nom: 'beurre' },
  { id: '2', nom: 'pomme de terre' },
  { id: '3', nom: 'filet de bœuf' },
]

describe('matchIngredient', () => {
  it("retourne l'id sur match exact", () => {
    expect(matchIngredient('beurre', ingredients)).toBe('1')
  })

  it("retourne l'id sur match partiel (ingrédient dans designation)", () => {
    expect(matchIngredient('beurre clarifié fermier', ingredients)).toBe('1')
  })

  it("retourne l'id sur match inverse (designation dans ingrédient)", () => {
    expect(matchIngredient('bœuf', ingredients)).toBe('3')
  })

  it('retourne null si aucun match', () => {
    expect(matchIngredient('tomate cerise', ingredients)).toBeNull()
  })

  it('matching insensible à la casse', () => {
    expect(matchIngredient('BEURRE DOUX', ingredients)).toBe('1')
  })

  it('priorité exact > partiel', () => {
    const ings = [
      { id: 'a', nom: 'beurre fermier' },
      { id: 'b', nom: 'beurre' },
    ]
    expect(matchIngredient('beurre', ings)).toBe('b')
  })

  it('retourne null sur liste vide', () => {
    expect(matchIngredient('beurre', [])).toBeNull()
  })
})
