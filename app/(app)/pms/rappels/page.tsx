'use client'
import { trpc } from '@/lib/trpc/client'

export default function RappelsPage() {
  const { data: alerts, refetch } = trpc.pms.getRappelAlerts.useQuery()
  const markTraite = trpc.pms.markRappelTraite.useMutation({ onSuccess: () => refetch() })

  const nonTraites = alerts?.filter((a) => !a.traite).length ?? 0

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Alertes RappelConso</h1>
        {nonTraites > 0 && (
          <p className="text-sm text-red-500 font-medium mt-1">
            {nonTraites} alerte(s) non traitée(s)
          </p>
        )}
      </div>

      {alerts?.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Aucune alerte de rappel produit</p>
          <p className="text-sm mt-1">Mis à jour tous les soirs à 21h</p>
        </div>
      )}

      <div className="space-y-3">
        {alerts?.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-2xl p-4 border ${
              alert.traite ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-red-50 border-red-200'
            }`}
            data-testid={`rappel-alert-${alert.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-bold text-red-700">{alert.nom_produit}</p>
                {alert.nom_marque && <p className="text-xs text-gray-500">{alert.nom_marque}</p>}
                <p className="text-sm text-gray-600 mt-1">{alert.motif}</p>
                {alert.date_rappel && (
                  <p className="text-xs text-gray-400 mt-1">
                    Date rappel: {new Date(alert.date_rappel).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {alert.lien_info && (
                  <a
                    href={alert.lien_info}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 underline mt-1 inline-block"
                  >
                    Plus d&apos;infos →
                  </a>
                )}
              </div>
              {!alert.traite && (
                <button
                  onClick={() => markTraite.mutate({ alertId: alert.id })}
                  disabled={markTraite.isPending}
                  className="px-3 py-1 text-xs bg-indigo-700 text-white rounded-full shrink-0"
                >
                  Traité
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
