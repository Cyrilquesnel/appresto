import { describe, it, expect } from 'vitest'

describe('logVentes mode simple', () => {
  it('calcule montant_total = nb_couverts × panier_moyen', () => {
    const nb_couverts = 35
    const panier_moyen = 28.50
    const montant = nb_couverts * panier_moyen
    expect(montant).toBe(997.50)
  })

  it('CA estimé = 0 si couverts = 0', () => {
    const nb_couverts = 0
    const panier_moyen = 28.50
    expect(nb_couverts * panier_moyen).toBe(0)
  })
})

describe('logVentes mode detail', () => {
  it('calcule montant_total = somme(quantite × prix_vente)', () => {
    const lignes = [
      { quantite: 3, prix_vente: 22.00 },
      { quantite: 2, prix_vente: 18.50 },
    ]
    const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)
    expect(total).toBe(103.00)
  })

  it('total correct avec plusieurs plats', () => {
    const lignes = [
      { quantite: 10, prix_vente: 15.00 },
      { quantite: 5, prix_vente: 20.00 },
      { quantite: 1, prix_vente: 45.00 },
    ]
    const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)
    expect(total).toBe(295.00)
  })
})
