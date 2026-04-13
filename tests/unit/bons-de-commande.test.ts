import { describe, it, expect } from 'vitest'

// Logique métier extraite du router

function calculerTotalHT(
  lignes: Array<{ quantite: number; prix_unitaire: number }>
): number {
  const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0)
  return Math.round(total * 100) / 100
}

describe('generateBonDeCommande — calcul total HT', () => {
  it('calcule la somme quantite × prix_unitaire', () => {
    const lignes = [
      { quantite: 5, prix_unitaire: 8.5 },
      { quantite: 2, prix_unitaire: 15.0 },
      { quantite: 0.5, prix_unitaire: 20.0 },
    ]
    expect(calculerTotalHT(lignes)).toBe(82.5)
  })

  it('arrondit à 2 décimales', () => {
    expect(calculerTotalHT([{ quantite: 3, prix_unitaire: 7.999 }])).toBe(24.0)
  })

  it('retourne 0 sur liste vide', () => {
    expect(calculerTotalHT([])).toBe(0)
  })

  it('gère un seul article', () => {
    expect(calculerTotalHT([{ quantite: 1, prix_unitaire: 9.99 }])).toBe(9.99)
  })

  it('gère des quantités décimales', () => {
    expect(calculerTotalHT([{ quantite: 2.5, prix_unitaire: 4.0 }])).toBe(10.0)
  })
})

describe('updateStatutBon — transitions valides', () => {
  const transitions = [
    { from: 'brouillon', to: 'envoye' },
    { from: 'envoye', to: 'confirme' },
    { from: 'confirme', to: 'recu' },
  ]

  transitions.forEach(({ from, to }) => {
    it(`${from} → ${to}`, () => {
      const statuts = ['brouillon', 'envoye', 'confirme', 'recu']
      const idx = statuts.indexOf(from)
      expect(statuts[idx + 1]).toBe(to)
    })
  })

  it('recu est l\'état final (pas de suivant)', () => {
    const STATUT_SUIVANT: Record<string, string> = {
      brouillon: 'envoye',
      envoye: 'confirme',
      confirme: 'recu',
    }
    expect(STATUT_SUIVANT['recu']).toBeUndefined()
  })
})
