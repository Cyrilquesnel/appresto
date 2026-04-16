'use client'
import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'

export default function IngredientsDeduplicationPage() {
  const utils = trpc.useUtils()

  const { data: pairs, isLoading } = trpc.ingredients.detectDuplicates.useQuery({
    threshold: 0.65,
  })

  const merge = trpc.ingredients.mergeIngredients.useMutation({
    onSuccess: () => utils.ingredients.detectDuplicates.invalidate(),
  })

  // Track which pairs are being merged (optimistic removal)
  const [merging, setMerging] = useState<Set<string>>(new Set())

  const handleMerge = (winnerId: string, loserId: string) => {
    const key = `${winnerId}-${loserId}`
    setMerging((prev) => new Set(prev).add(key))
    merge.mutate(
      { winner_id: winnerId, loser_id: loserId },
      {
        onError: () =>
          setMerging((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          }),
      }
    )
  }

  const visiblePairs = (pairs ?? []).filter(
    (p) => !merging.has(`${p.id_a}-${p.id_b}`) && !merging.has(`${p.id_b}-${p.id_a}`)
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/settings" className="text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold">Doublons ingrédients</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Fusionnez les doublons — les fiches techniques seront automatiquement mises à jour
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-accent rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && visiblePairs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">✓</p>
          <p className="font-medium text-gray-600">Aucun doublon détecté</p>
          <p className="text-sm mt-1">Votre mercuriale est propre</p>
        </div>
      )}

      {visiblePairs.length > 0 && (
        <p className="text-sm text-gray-500">
          {visiblePairs.length} doublon{visiblePairs.length > 1 ? 's' : ''} détecté
          {visiblePairs.length > 1 ? 's' : ''}
        </p>
      )}

      <div className="space-y-3">
        {visiblePairs.map((pair) => {
          const scoreColor =
            pair.score >= 0.9
              ? 'bg-red-100 text-red-700'
              : pair.score >= 0.75
                ? 'bg-orange-100 text-orange-700'
                : 'bg-yellow-100 text-yellow-700'

          const isPending =
            merging.has(`${pair.id_a}-${pair.id_b}`) || merging.has(`${pair.id_b}-${pair.id_a}`)

          return (
            <div
              key={`${pair.id_a}-${pair.id_b}`}
              className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Similarité</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
                  {Math.round(pair.score * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPending || merge.isPending}
                  onClick={() => handleMerge(pair.id_a, pair.id_b)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-transparent bg-gray-50 hover:border-accent/40 hover:bg-accent/5 transition-colors text-left disabled:opacity-50"
                >
                  <span className="font-semibold text-gray-900 text-sm leading-tight">
                    {pair.nom_a}
                  </span>
                  <span className="text-xs text-gray-400 self-start">Supprimer</span>
                </button>

                <button
                  type="button"
                  disabled={isPending || merge.isPending}
                  onClick={() => handleMerge(pair.id_b, pair.id_a)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-transparent bg-gray-50 hover:border-accent/40 hover:bg-accent/5 transition-colors text-left disabled:opacity-50"
                >
                  <span className="font-semibold text-gray-900 text-sm leading-tight">
                    {pair.nom_b}
                  </span>
                  <span className="text-xs text-gray-400 self-start">Supprimer</span>
                </button>
              </div>

              {isPending && <p className="text-xs text-accent text-center">Fusion en cours…</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
