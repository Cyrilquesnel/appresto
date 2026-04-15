'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import type { IngredientLinkSuggestion } from '@/server/routers/fiches'

interface IngredientLinkModalProps {
  platId: string
  suggestions: IngredientLinkSuggestion[]
  onDone: () => void
}

export function IngredientLinkModal({ platId, suggestions, onDone }: IngredientLinkModalProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())

  const linkIngredient = trpc.fiches.linkIngredient.useMutation()

  const pending = suggestions.filter(
    (s) => !dismissed.has(s.from_ingredient_id) && !confirmed.has(s.from_ingredient_id)
  )

  const handleConfirm = async (s: IngredientLinkSuggestion) => {
    await linkIngredient.mutateAsync({
      plat_id: platId,
      from_ingredient_id: s.from_ingredient_id,
      to_ingredient_id: s.to_ingredient_id,
    })
    setConfirmed((prev) => new Set(prev).add(s.from_ingredient_id))
  }

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  if (pending.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center space-y-4">
          <p className="text-lg font-semibold text-gray-900">Tout est lié ✓</p>
          <p className="text-sm text-gray-500">
            Les prix de la mercuriale seront utilisés pour calculer vos coûts.
          </p>
          <button
            onClick={onDone}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl active:scale-95 transition-transform"
          >
            Voir la fiche
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md space-y-4 p-6 max-h-[80vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Lier les ingrédients à la mercuriale
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Ces ingrédients existent déjà dans votre mercuriale sous un nom différent. Confirmez le
            lien pour que les prix se mettent à jour automatiquement.
          </p>
        </div>

        <div className="space-y-3">
          {pending.map((s) => (
            <div
              key={s.from_ingredient_id}
              className="border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                  {s.from_nom}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                  {s.to_nom}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(s)}
                  disabled={linkIngredient.isPending}
                  className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => handleDismiss(s.from_ingredient_id)}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg active:scale-95 transition-transform"
                >
                  Ignorer
                </button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onDone} className="w-full py-3 text-gray-500 text-sm hover:text-gray-700">
          Continuer sans lier
        </button>
      </div>
    </div>
  )
}
