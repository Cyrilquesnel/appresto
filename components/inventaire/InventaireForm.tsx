'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type IngredientStock = {
  ingredient_id: string
  nom: string
  unite: string
  quantite_actuelle: number | null
  date_inventaire: string | null
}

interface InventaireFormProps {
  ingredients: IngredientStock[]
  onSaved: () => void
}

export function InventaireForm({ ingredients, onSaved }: InventaireFormProps) {
  const [quantities, setQuantities] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const ing of ingredients) {
      if (ing.quantite_actuelle !== null) m.set(ing.ingredient_id, ing.quantite_actuelle)
    }
    return m
  })
  const [saved, setSaved] = useState(false)

  const save = trpc.commandes['inventaire.save'].useMutation({
    onSuccess: () => {
      setSaved(true)
      onSaved()
    },
  })

  function handleSave() {
    const lignes = Array.from(quantities.entries())
      .map(([ingredient_id, quantite]) => {
        const ing = ingredients.find((i) => i.ingredient_id === ingredient_id)
        return { ingredient_id, quantite, unite: ing?.unite ?? 'kg' }
      })
      .filter((l) => l.quantite >= 0)

    if (lignes.length === 0) return
    save.mutate({ lignes })
  }

  return (
    <div>
      <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 mb-4">
        {ingredients.map((ing) => (
          <div key={ing.ingredient_id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-sm text-gray-800 truncate">{ing.nom}</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={quantities.get(ing.ingredient_id) ?? ''}
              placeholder="0"
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                const next = new Map(quantities)
                if (isNaN(val)) {
                  next.delete(ing.ingredient_id)
                } else {
                  next.set(ing.ingredient_id, val)
                }
                setQuantities(next)
                setSaved(false)
              }}
              className="w-20 text-right px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-accent"
            />
            <span className="text-xs text-gray-400 w-8">{ing.unite}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={save.isPending || quantities.size === 0}
        className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
      >
        {save.isPending ? 'Sauvegarde...' : "Sauvegarder l'inventaire"}
      </button>

      {saved && (
        <p className="text-center text-sm text-green-600 mt-3 font-medium">
          ✓ Inventaire sauvegardé
        </p>
      )}

      {save.isError && (
        <p className="text-center text-sm text-red-500 mt-3">{save.error.message}</p>
      )}
    </div>
  )
}
