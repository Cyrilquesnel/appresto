'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import type { InvoiceLigne } from './InvoiceUpload'

interface Props {
  fournisseurId: string | null
  aiSuggested: InvoiceLigne[]
  onConfirmed: (confirmedCount: number) => void
  onClose: () => void
}

export function InvoiceReviewModal({ fournisseurId, aiSuggested, onConfirmed, onClose }: Props) {
  const utils = trpc.useUtils()

  const confirmMapping = trpc.ingredients.confirmMapping.useMutation({
    onSuccess: () => utils.commandes.getAllIngredientsMercuriale.invalidate(),
  })

  // Track confirmed lines
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<string | null>(null)

  if (aiSuggested.length === 0) return null

  const pending = aiSuggested.filter((l) => !confirmed.has(l.designation))

  const handleConfirm = async (ligne: InvoiceLigne) => {
    if (!ligne.ingredient_id) return
    setConfirming(ligne.designation)
    try {
      await confirmMapping.mutateAsync({
        ingredient_id: ligne.ingredient_id,
        fournisseur_id: fournisseurId ?? undefined,
        designation_raw: ligne.designation,
      })
      setConfirmed((prev) => new Set(prev).add(ligne.designation))
    } finally {
      setConfirming(null)
    }
  }

  const handleConfirmAll = async () => {
    let count = 0
    for (const ligne of pending) {
      if (ligne.ingredient_id) {
        await handleConfirm(ligne)
        count++
      }
    }
    onConfirmed(count)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Suggestions IA</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Confirmez pour mémoriser — ne sera plus demandé
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lines */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {aiSuggested.map((ligne) => {
            const isConfirmed = confirmed.has(ligne.designation)
            const isConfirming = confirming === ligne.designation
            const confidencePct = Math.round((ligne.ai_confidence ?? 0) * 100)

            return (
              <div key={ligne.designation} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{ligne.designation}</p>
                  {ligne.ingredient_id && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        → {/* ingredient_nom not stored in ligne, use designation as fallback */}
                        Ingrédient mappé
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          confidencePct >= 90
                            ? 'bg-green-100 text-green-700'
                            : confidencePct >= 70
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {confidencePct}%
                      </span>
                    </div>
                  )}
                </div>

                {isConfirmed ? (
                  <span className="text-xs text-green-600 font-medium shrink-0">✓ Mémorisé</span>
                ) : (
                  <button
                    type="button"
                    disabled={isConfirming || !ligne.ingredient_id}
                    onClick={() => handleConfirm(ligne)}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-medium disabled:opacity-50"
                  >
                    {isConfirming ? '…' : 'Confirmer'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {pending.length > 1 && (
          <div className="p-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={confirmMapping.isPending}
              className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60"
            >
              Tout confirmer ({pending.length})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
