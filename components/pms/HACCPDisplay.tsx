'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

export function HACCPDisplay() {
  const { data, refetch, isLoading } = trpc.pms.getHACCPPlan.useQuery()
  const generate = trpc.pms.generateHACCP.useMutation({
    onSuccess: () => refetch(),
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 rounded-2xl" />
  }

  return (
    <div className="space-y-4" data-testid="haccp-display">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Plan HACCP</h2>
          {data?.last_generated && (
            <p className="text-xs text-gray-400">
              Généré le {new Date(data.last_generated).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={!data?.can_generate || generate.isPending}
          className="px-4 py-2 bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={!data?.can_generate ? `Créez ${3 - (data?.plats_count ?? 0)} plat(s) de plus` : ''}
          data-testid="generate-haccp-button"
        >
          {generate.isPending ? '⏳ Génération...' : data?.points.length ? 'Régénérer' : 'Générer'}
        </button>
      </div>

      {!data?.can_generate && (
        <div
          className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200"
          data-testid="haccp-blocked"
        >
          <p className="text-sm text-yellow-700 font-medium">
            Créez au moins 3 plats actifs pour générer le plan HACCP
          </p>
          <p className="text-xs text-gray-500 mt-1">({data?.plats_count ?? 0}/3 plats actifs)</p>
        </div>
      )}

      {data?.points.map((point) => (
        <div
          key={point.id}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          data-testid={`ccp-${point.ccp_numero}`}
        >
          <button
            onClick={() => setExpanded(expanded === point.id ? null : point.id)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-indigo-700 text-white px-2 py-0.5 rounded-full">
                {point.ccp_numero}
              </span>
              <span className="font-semibold text-gray-900">{point.etape_critique}</span>
            </div>
            <span className="text-gray-400 text-sm">{expanded === point.id ? '▲' : '▼'}</span>
          </button>

          {expanded === point.id && (
            <div className="px-4 pb-4 space-y-3 text-sm border-t border-gray-100">
              {point.plat_nom && (
                <p className="text-indigo-600 font-medium pt-2">Plat: {point.plat_nom}</p>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Danger</p>
                <p className="text-gray-700">{point.danger}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Limite critique</p>
                <p className="text-gray-900 font-medium">
                  {point.temperature_critique && `${point.temperature_critique}°C — `}
                  {point.limite_critique}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Surveillance</p>
                <p className="text-gray-700">{point.mesure_surveillance}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Action corrective</p>
                <p className="text-gray-700">{point.action_corrective}</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {generate.isError && (
        <p className="text-red-500 text-sm text-center">{generate.error.message}</p>
      )}
    </div>
  )
}
