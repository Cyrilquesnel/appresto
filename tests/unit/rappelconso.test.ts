import { describe, it, expect } from 'vitest'
import { matchRappelWithIngredients } from '@/lib/rappelconso'

const mockRappel = {
  rappelguid: 'test-guid',
  nom_produit_rappele: 'Fromage brie de Meaux',
  nom_marque_produit: 'Ferme Dupont',
  categorie_produit: 'Fromages',
  sous_categorie_produit: 'Fromages à pâte molle',
  motif_rappel: 'Présence de Listeria',
  risques_pour_le_consommateur: 'Listériose',
  date_debut_fev: '2026-04-01',
}

describe('matchRappelWithIngredients', () => {
  it('trouve un match si le nom de l\'ingrédient est dans le produit rappelé', () => {
    const ingredients = [
      { id: '1', nom: 'brie' },
      { id: '2', nom: 'camembert' },
    ]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).not.toBeNull()
    expect(match?.ingredient_id).toBe('1')
  })

  it('retourne null si pas de match', () => {
    const ingredients = [
      { id: '1', nom: 'beurre' },
      { id: '2', nom: 'crème' },
    ]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).toBeNull()
  })

  it('matching insensible à la casse', () => {
    const ingredients = [{ id: '1', nom: 'BRIE' }]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match).not.toBeNull()
  })

  it('retourne le nom de l\'ingrédient correspondant', () => {
    const ingredients = [{ id: '42', nom: 'brie' }]
    const match = matchRappelWithIngredients(mockRappel, ingredients)
    expect(match?.nom).toBe('brie')
    expect(match?.ingredient_id).toBe('42')
  })
})
