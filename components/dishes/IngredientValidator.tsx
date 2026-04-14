'use client'
import { useState } from 'react'
import { IngredientSearch } from './IngredientSearch'

export interface ValidatedIngredient {
  id?: string
  nom: string
  grammage: number
  unite: string
  allergenes: string[]
  confiance?: number
  isManual?: boolean
}

interface IngredientValidatorProps {
  initialIngredients: ValidatedIngredient[]
  onChange: (ingredients: ValidatedIngredient[]) => void
}

export function IngredientValidator({ initialIngredients, onChange }: IngredientValidatorProps) {
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)
  const [showSearch, setShowSearch] = useState(false)

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

  const addFromSearch = (ingredient: { id: string; nom: string; allergenes: string[] }) => {
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
          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
          data-testid={`ingredient-row-${index}`}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{ing.nom}</p>
            {ing.allergenes.length > 0 && (
              <p className="text-xs text-amber-600 truncate">
                Allergènes: {ing.allergenes.join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
          {ing.confiance !== undefined && ing.confiance < 0.65 && (
            <span className="text-xs text-amber-500 ml-1" title="Confiance faible">
              ⚠
            </span>
          )}
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
