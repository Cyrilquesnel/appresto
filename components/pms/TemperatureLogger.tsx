'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { queuePMSRecord, requestBackgroundSync } from '@/lib/pms-offline'

interface EquipementForLogger {
  id: string
  nom: string
  type: string
  temp_min: number
  temp_max: number
}

interface TemperatureLoggerProps {
  equipement: EquipementForLogger
  onLogged: (conforme: boolean) => void
}

export function TemperatureLogger({ equipement, onLogged }: TemperatureLoggerProps) {
  const [value, setValue] = useState('')
  const [actionCorrective, setActionCorrective] = useState('')
  const [result, setResult] = useState<{ conforme: boolean } | null>(null)
  const [queuedOffline, setQueuedOffline] = useState(false)

  const log = trpc.pms.saveTemperatureLog.useMutation({
    onSuccess: (data) => {
      setResult(data)
      if (data.conforme) {
        setTimeout(() => {
          onLogged(true)
          setResult(null)
          setValue('')
        }, 1500)
      }
    },
  })

  const parsed = parseFloat(value)
  const isHorsPlage =
    value !== '' && !isNaN(parsed) && (parsed < equipement.temp_min || parsed > equipement.temp_max)

  const handleSubmit = async () => {
    try {
      log.mutate({
        equipement_id: equipement.id,
        valeur: parsed,
        action_corrective: actionCorrective || undefined,
      })
    } catch {
      // Réseau indisponible — mise en file d'attente offline
      await queuePMSRecord({
        url: '/api/trpc/pms.saveTemperatureLog',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipement_id: equipement.id,
          valeur: parsed,
          action_corrective: actionCorrective || null,
        }),
        type: 'temperature',
      })
      await requestBackgroundSync()
      setQueuedOffline(true)
      setTimeout(() => {
        onLogged(true)
        setQueuedOffline(false)
        setValue('')
      }, 2000)
    }
  }

  if (queuedOffline) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
        <div className="py-4 rounded-2xl text-center font-bold text-lg bg-amber-100 text-amber-700">
          📶 Hors ligne — enregistré localement
        </div>
        <p className="text-xs text-amber-600 text-center mt-2">
          Sera synchronisé automatiquement à la reconnexion
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
      data-testid={`temp-logger-${equipement.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{equipement.nom}</h3>
        <span className="text-xs text-gray-400">
          [{equipement.temp_min}°C / {equipement.temp_max}°C]
        </span>
      </div>

      <div className="mb-3">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          step={0.1}
          placeholder="Température (°C)"
          className={`w-full px-4 py-6 text-4xl font-bold text-center rounded-2xl border-2 focus:outline-none ${
            isHorsPlage
              ? 'border-red-400 bg-red-50 text-red-600'
              : 'border-gray-200 bg-gray-50 text-gray-900'
          }`}
          data-testid={`temp-input-${equipement.id}`}
        />
        {isHorsPlage && (
          <p
            className="text-red-500 text-sm font-medium mt-2 text-center animate-pulse"
            data-testid="alerte-hors-plage"
          >
            ⚠ Température hors plage ! Action corrective requise
          </p>
        )}
      </div>

      {isHorsPlage && (
        <textarea
          value={actionCorrective}
          onChange={(e) => setActionCorrective(e.target.value)}
          placeholder="Action corrective prise (obligatoire si hors plage)"
          className="w-full px-4 py-3 rounded-xl border border-red-300 text-sm mb-3"
          rows={2}
          data-testid={`action-corrective-${equipement.id}`}
        />
      )}

      {result ? (
        <div
          className={`py-4 rounded-2xl text-center font-bold text-lg ${
            result.conforme ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {result.conforme ? '✓ Conforme' : '⚠ Non conforme — enregistré'}
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value || isNaN(parsed) || log.isPending || (isHorsPlage && !actionCorrective)}
          className="w-full py-4 bg-accent text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
          data-testid={`save-temp-${equipement.id}`}
        >
          {log.isPending ? '⏳ Enregistrement...' : '✓ Valider'}
        </button>
      )}

      {log.isError && <p className="text-sm text-red-500 text-center mt-2">{log.error.message}</p>}
    </div>
  )
}
