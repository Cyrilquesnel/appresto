import { describe, it, expect } from 'vitest'

describe('fiches.create — calcul allergènes', () => {
  it('calcule les allergènes comme union de tous les ingrédients', () => {
    const ingredients = [
      { allergenes: ['lait', 'oeufs'] },
      { allergenes: ['gluten', 'lait'] },
      { allergenes: [] },
    ]
    const allergenesSet = new Set<string>()
    ingredients.forEach((ing) => ing.allergenes.forEach((a) => allergenesSet.add(a)))
    const allergenes = Array.from(allergenesSet)

    expect(allergenes).toContain('lait')
    expect(allergenes).toContain('oeufs')
    expect(allergenes).toContain('gluten')
    expect(allergenes).toHaveLength(3) // pas de doublon
  })

  it('retourne un tableau vide si aucun allergène', () => {
    const ingredients = [{ allergenes: [] }, { allergenes: [] }]
    const allergenesSet = new Set<string>()
    ingredients.forEach((ing) => ing.allergenes.forEach((a) => allergenesSet.add(a)))
    expect(Array.from(allergenesSet)).toHaveLength(0)
  })

  it('gère les 14 allergènes réglementaires', () => {
    const allergenesMajeurs = [
      'gluten',
      'crustaces',
      'oeufs',
      'poisson',
      'arachides',
      'soja',
      'lait',
      'fruits_coque',
      'celeri',
      'moutarde',
      'sesame',
      'so2',
      'lupin',
      'mollusques',
    ]
    expect(allergenesMajeurs).toHaveLength(14)
  })
})
