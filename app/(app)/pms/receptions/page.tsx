'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { ReceptionForm } from '@/components/pms/ReceptionForm'

export default function ReceptionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)
  const { data: receptions, refetch, isLoading } = trpc.pms.getReceptions.useQuery({ jours: 30 })

  if (successId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Réception enregistrée !</h2>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setSuccessId(null)
              setShowForm(false)
              refetch()
            }}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl"
          >
            Retour à la liste
          </button>
          <button
            onClick={() => setSuccessId(null)}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
          >
            Nouvelle réception
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Réceptions</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl"
        >
          {showForm ? 'Annuler' : '+ Nouvelle'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4">Nouvelle réception</h2>
          <ReceptionForm onSuccess={(id) => setSuccessId(id)} />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-indigo-600 rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && receptions?.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">Aucune réception ce mois-ci</p>
        </div>
      )}

      <div className="space-y-3">
        {receptions?.map((reception) => {
          const fournisseurNom =
            (reception.fournisseur as unknown as { nom: string } | null)?.nom ?? 'Fournisseur'
          const anomalies =
            (reception.items as unknown as Array<{ conforme: boolean }> | null)?.filter(
              (i) => !i.conforme
            ).length ?? 0
          return (
            <div
              key={reception.id}
              className={`rounded-2xl p-4 border ${reception.statut === 'anomalie' ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{fournisseurNom}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(reception.date_reception).toLocaleDateString('fr-FR')}
                    {reception.numero_bl && ` — BL ${reception.numero_bl}`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      reception.statut === 'conforme'
                        ? 'bg-green-100 text-green-700'
                        : reception.statut === 'anomalie'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {reception.statut}
                  </span>
                  {anomalies > 0 && (
                    <p className="text-xs text-red-500 mt-1">{anomalies} anomalie(s)</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
