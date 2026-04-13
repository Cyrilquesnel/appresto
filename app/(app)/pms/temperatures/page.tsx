'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { TemperatureLogger } from '@/components/pms/TemperatureLogger'
import { EquipementSetup } from '@/components/pms/EquipementSetup'
import { PushPermissionPrompt } from '@/components/pms/PushPermissionPrompt'

export default function TemperaturesPage() {
  const [showSetup, setShowSetup] = useState(false)
  const { data: equipements, isLoading } = trpc.pms.listEquipements.useQuery()
  const { data: logs } = trpc.pms.getTemperatureLogs.useQuery({ jours: 7 })
  const utils = trpc.useUtils()

  const nonConformes = logs?.filter(l => !l.conforme).length ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Températures</h1>
          {nonConformes > 0 && (
            <p className="text-sm text-red-500 font-medium">{nonConformes} non-conforme(s) cette semaine</p>
          )}
        </div>
        <button
          onClick={() => setShowSetup(v => !v)}
          className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl"
        >
          {showSetup ? 'Fermer' : '+ Équipement'}
        </button>
      </div>

      {showSetup && (
        <div className="mb-6 bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4">Ajouter un équipement</h2>
          <EquipementSetup onSuccess={() => setShowSetup(false)} />
        </div>
      )}

      <PushPermissionPrompt />

      {equipements && equipements.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🌡</p>
          <p className="font-medium">Aucun équipement configuré</p>
          <p className="text-sm mt-1">Ajoutez votre premier frigo ou congélateur</p>
        </div>
      )}

      <div className="space-y-4">
        {equipements?.map(equipement => (
          <TemperatureLogger
            key={equipement.id}
            equipement={equipement}
            onLogged={() => utils.pms.getTemperatureLogs.invalidate()}
          />
        ))}
      </div>

      {logs && logs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Historique 7 jours
          </h2>
          <div className="space-y-2">
            {logs.slice(0, 10).map(log => {
              const equipNom = (log.equipement as unknown as { nom: string } | null)?.nom ?? 'Équipement'
              const date = new Date(log.timestamp_releve).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })
              return (
                <div
                  key={log.id}
                  className={`flex items-center justify-between px-4 py-2 rounded-xl text-sm ${
                    log.conforme ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div>
                    <span className="font-medium">{equipNom}</span>
                    <span className="text-gray-400 ml-2 text-xs">{date}</span>
                  </div>
                  <span className={`font-bold ${log.conforme ? 'text-green-600' : 'text-red-600'}`}>
                    {log.valeur}°C {log.conforme ? '✓' : '✗'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
