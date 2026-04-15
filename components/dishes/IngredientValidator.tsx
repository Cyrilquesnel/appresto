'use client'
import { useState } from 'react'
import { IngredientSearch } from './IngredientSearch'
import { FournisseurSelect } from './FournisseurSelect'

export interface ValidatedIngredient {
  id?: string
  nom: string
  grammage: number
  unite: string
  allergenes: string[]
  confiance?: number
  isManual?: boolean
  fournisseur_id?: string
  prix_achat?: number
  unite_achat?: string
}

interface IngredientValidatorProps {
  initialIngredients: ValidatedIngredient[]
  onChange: (ingredients: ValidatedIngredient[]) => void
}

export function IngredientValidator({ initialIngredients, onChange }: IngredientValidatorProps) {
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)
  const [showSearch, setShowSearch] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const update = (updated: ValidatedIngredient[]) => {
    setIngredients(updated)
    onChange(updated)
  }

  const remove = (index: number) => {
    update(ingredients.filter((_, i) => i !== index))
  }

  const updateGrammage = (index: number, grammage: number) => {
    update(ingredients.map((ing, i) => (i === index ? { ...ing, grammage } : ing)))
  }

  const updateNom = (index: number, nom: string) => {
    // Effacer l'id : le nom modifié manuellement devient un nouvel ingrédient côté serveur
    update(ingredients.map((ing, i) => (i === index ? { ...ing, nom, id: undefined } : ing)))
  }

  const updateFournisseur = (index: number, fournisseur_id: string | undefined) => {
    update(ingredients.map((ing, i) => (i === index ? { ...ing, fournisseur_id } : ing)))
  }

  const updatePrix = (index: number, prix_achat: number) => {
    update(ingredients.map((ing, i) => (i === index ? { ...ing, prix_achat } : ing)))
  }

  const updateUniteAchat = (index: number, unite_achat: string) => {
    update(ingredients.map((ing, i) => (i === index ? { ...ing, unite_achat } : ing)))
  }

  const addFromSearch = (ingredient: { id?: string; nom: string; allergenes: string[] }) => {
    const newIng: ValidatedIngredient = {
      id: ingredient.id,
      nom: ingredient.nom,
      grammage: 100,
      unite: 'g',
      allergenes: ingredient.allergenes,
      isManual: true,
    }
    update([...ingredients, newIng])
    setShowSearch(false)
  }

  return (
    <div className="space-y-3" data-testid="ingredient-validator">
      {ingredients.map((ing, index) => (
        <div
          key={index}
          className="p-3 bg-white rounded-xl border border-gray-200"
          data-testid={`ingredient-row-${index}`}
        >
          {/* Ligne principale : nom + grammage + supprimer */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {editingIndex === index ? (
                <input
                  type="text"
                  autoFocus
                  value={ing.nom}
                  onChange={(e) => updateNom(index, e.target.value)}
                  onBlur={() => setEditingIndex(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingIndex(null)}
                  className="font-medium text-gray-900 w-full border-b border-accent/60 outline-none bg-transparent"
                />
              ) : (
                <p
                  className="font-medium text-gray-900 truncate cursor-pointer hover:text-accent"
                  onClick={() => setEditingIndex(index)}
                  title="Cliquer pour modifier"
                >
                  {ing.nom || <span className="text-gray-400 italic">Ingrédient {index + 1}</span>}
                </p>
              )}
              {ing.allergenes.length > 0 && (
                <p className="text-xs text-amber-600 truncate">
                  Allergènes: {ing.allergenes.join(', ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ing.confiance !== undefined && ing.confiance < 0.65 && (
                <span className="text-xs text-amber-500" title="Confiance faible">
                  ⚠
                </span>
              )}
              <input
                type="number"
                value={ing.grammage}
                onChange={(e) => updateGrammage(index, Number(e.target.value))}
                min={1}
                className="w-20 px-2 py-1 text-center border border-gray-200 rounded-lg text-sm"
                data-testid={`ingredient-grammage-${index}`}
              />
              <span className="text-xs text-gray-500">{ing.unite}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                aria-label={`Supprimer ${ing.nom}`}
                data-testid={`ingredient-remove-${index}`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Prix & fournisseur en dessous */}
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer select-none">
              + Prix &amp; fournisseur
            </summary>
            <div className="mt-2 space-y-2">
              <FournisseurSelect
                value={ing.fournisseur_id}
                onChange={(id) => updateFournisseur(index, id)}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Prix HT"
                  value={ing.prix_achat ?? ''}
                  onChange={(e) => updatePrix(index, parseFloat(e.target.value))}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                  min={0}
                  step={0.01}
                />
                <select
                  value={ing.unite_achat ?? 'kg'}
                  onChange={(e) => updateUniteAchat(index, e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                >
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="pc">pc</option>
                </select>
              </div>
            </div>
          </details>
        </div>
      ))}

      {showSearch ? (
        <div className="relative">
          <IngredientSearch
            onSelect={addFromSearch}
            placeholder="Rechercher un ingrédient à ajouter..."
          />
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          data-testid="add-ingredient-button"
        >
          + Ajouter un ingrédient
        </button>
      )}
    </div>
  )
}
