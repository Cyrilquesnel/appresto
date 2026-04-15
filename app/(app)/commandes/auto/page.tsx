'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'

export default function CommandeAutoPage() {
  const router = useRouter()
  const [jours, setJours] = useState(7)

  const { data, isLoading, refetch } = trpc.commandes.suggestCommande.useQuery({ jours })
  const generateBon = trpc.commandes.generateBonDeCommande.useMutation({
    onSuccess: ({ bon_id }) => router.push(`/commandes/${bon_id}`),
  })

  function handleCreateBon(suggestion: NonNullable<typeof data>['suggestions'][number]) {
    if (!suggestion.fournisseur_id) return
    generateBon.mutate({
      fournisseur_id: suggestion.fournisseur_id,
      lignes: suggestion.lignes
        .filter((l) => l.ingredient_id)
        .map((l) => ({
          ingredient_id: l.ingredient_id,
          quantite: l.quantite_totale,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire ?? undefined,
        })),
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ←
        </button>
        <h1 className="text-xl font-bold">Commande auto</h1>
      </div>

      {/* Sélecteur période */}
      <div className="flex gap-2 mb-6">
        {[3, 7, 14].map((j) => (
          <button
            key={j}
            onClick={() => {
              setJours(j)
              setTimeout(() => refetch(), 0)
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              jours === j ? 'bg-accent text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {j} jours
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Résumé */}
          <div className="bg-accent/5 rounded-2xl p-4 mb-4">
            <p className="text-sm text-accent">
              Basé sur <strong>{data.nb_plats} plats</strong> vendus ces{' '}
              <strong>{data.jours} derniers jours</strong>
            </p>
          </div>

          {data.suggestions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-2xl mb-2">📊</p>
              <p className="font-medium">Pas assez de données</p>
              <p className="text-sm mt-1">
                Enregistrez des ventes avec les plats vendus pour générer des suggestions.
              </p>
            </div>
          )}

          {data.suggestions.map((suggestion, i) => {
            const totalEstime = suggestion.lignes.reduce(
              (s, l) => s + (l.prix_unitaire ?? 0) * l.quantite_totale,
              0
            )
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 mb-4 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900">{suggestion.fournisseur_nom}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {suggestion.lignes.length} ingrédient
                      {suggestion.lignes.length > 1 ? 's' : ''}
                      {totalEstime > 0 && ` · ${totalEstime.toFixed(2)} € estimé`}
                    </p>
                  </div>
                  {suggestion.fournisseur_id && (
                    <button
                      onClick={() => handleCreateBon(suggestion)}
                      disabled={generateBon.isPending}
                      className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                    >
                      Commander →
                    </button>
                  )}
                </div>

                <div className="divide-y divide-gray-50">
                  {suggestion.lignes.map((ligne, j) => (
                    <div key={j} className="px-4 py-2.5 flex justify-between items-center text-sm">
                      <span className="text-gray-800">{ligne.nom}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-gray-900">
                          {ligne.quantite_totale} {ligne.unite}
                        </span>
                        {ligne.prix_unitaire && (
                          <span className="text-gray-400 text-xs">
                            {(ligne.quantite_totale * ligne.prix_unitaire).toFixed(2)} €
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
