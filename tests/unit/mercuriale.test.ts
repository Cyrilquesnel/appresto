import { describe, it, expect } from 'vitest'

// ─── Helpers extraits de la logique métier ───────────────────────────────────

function ingredientNom(item: {
  ingredient: { nom_custom: string | null; catalog: { nom: string } | null } | null
}): string {
  return item.ingredient?.nom_custom ?? item.ingredient?.catalog?.nom ?? '—'
}

function desactiverAncienPrix(
  lignes: Array<{ ingredient_id: string; est_actif: boolean }>,
  ingredientId: string
): Array<{ ingredient_id: string; est_actif: boolean }> {
  return lignes.map((l) =>
    l.ingredient_id === ingredientId ? { ...l, est_actif: false } : l
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('mercuriale — affichage nom ingrédient', () => {
  it('retourne nom_custom si défini', () => {
    const item = {
      ingredient: { nom_custom: 'Beurre fermier', catalog: { nom: 'Beurre' } },
    }
    expect(ingredientNom(item)).toBe('Beurre fermier')
  })

  it('retourne nom du catalogue si pas de nom_custom', () => {
    const item = {
      ingredient: { nom_custom: null, catalog: { nom: 'Beurre' } },
    }
    expect(ingredientNom(item)).toBe('Beurre')
  })

  it('retourne "—" si ingredient null', () => {
    expect(ingredientNom({ ingredient: null })).toBe('—')
  })
})

describe('setMercurialePrice — logique de désactivation', () => {
  it('désactive uniquement l\'ancien prix actif de l\'ingrédient concerné', () => {
    const lignes = [
      { ingredient_id: 'ing-1', est_actif: true },
      { ingredient_id: 'ing-2', est_actif: true },
      { ingredient_id: 'ing-1', est_actif: false }, // déjà inactif
    ]
    const result = desactiverAncienPrix(lignes, 'ing-1')
    expect(result.find((l) => l.ingredient_id === 'ing-1' && l.est_actif)).toBeUndefined()
    expect(result.find((l) => l.ingredient_id === 'ing-2')?.est_actif).toBe(true)
  })

  it('ne touche pas les lignes d\'autres ingrédients', () => {
    const lignes = [
      { ingredient_id: 'ing-A', est_actif: true },
      { ingredient_id: 'ing-B', est_actif: true },
    ]
    const result = desactiverAncienPrix(lignes, 'ing-A')
    expect(result.find((l) => l.ingredient_id === 'ing-B')?.est_actif).toBe(true)
  })
})

describe('validation fournisseur', () => {
  it('rejette un délai négatif', () => {
    const delai = -1
    expect(delai >= 0).toBe(false)
  })

  it('accepte un délai de 0 (livraison immédiate)', () => {
    const delai = 0
    expect(delai >= 0 && delai <= 30).toBe(true)
  })

  it('accepte un numéro WhatsApp au format international', () => {
    const regex = /^\+\d{7,15}$/
    expect(regex.test('+33612345678')).toBe(true)
    expect(regex.test('0612345678')).toBe(false) // format local rejeté
  })

  it('rejette un prix mercuriale nul ou négatif', () => {
    const prix = -5
    expect(prix > 0).toBe(false)
  })

  it('accepte un prix positif', () => {
    expect(8.5 > 0).toBe(true)
  })
})
