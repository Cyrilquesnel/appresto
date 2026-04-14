'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

function getDefaultRange() {
  const now = new Date()
  const debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const fin = now.toISOString().split('T')[0]
  return { debut, fin }
}

export default function AnalytiquesPage() {
  const defaults = getDefaultRange()
  const [dateDebut, setDateDebut] = useState(defaults.debut)
  const [dateFin, setDateFin] = useState(defaults.fin)
  const [tri, setTri] = useState<'ca' | 'quantite' | 'food_cost_pct' | 'marge'>('ca')

  const { data: plats, isLoading } = trpc.dashboard.getTopFlop.useQuery({
    date_debut: dateDebut,
    date_fin: dateFin,
  })

  const sorted = [...(plats ?? [])].sort((a, b) => {
    if (tri === 'food_cost_pct') {
      return (b.food_cost_pct ?? 0) - (a.food_cost_pct ?? 0)
    }
    return (b[tri] as number) - (a[tri] as number)
  })

  const totalCA = sorted.reduce((s, p) => s + p.ca, 0)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-xl font-bold">Analytiques</h1>
      </div>

      {/* Sélecteur période */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </div>
      </div>

      {/* Tri */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(
          [
            { key: 'ca', label: 'CA' },
            { key: 'quantite', label: 'Qtité' },
            { key: 'marge', label: 'Marge' },
            { key: 'food_cost_pct', label: 'Food cost' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTri(key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              tri === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-indigo-600 rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm">Aucune vente par plat sur cette période</p>
          <p className="text-xs mt-1">
            Utilisez la saisie détaillée pour associer les ventes aux plats
          </p>
        </div>
      )}

      {/* Tableau top/flop */}
      <div className="space-y-2">
        {sorted.map((plat, i) => {
          const partCA = totalCA > 0 ? (plat.ca / totalCA) * 100 : 0
          const isMeilleureRenta = plat.food_cost_pct !== null && plat.food_cost_pct < 30
          const isAlerte = plat.food_cost_pct !== null && plat.food_cost_pct > 40

          return (
            <div
              key={plat.plat_id}
              className={`rounded-2xl p-4 border ${
                i === 0 ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-mono w-5">#{i + 1}</span>
                    <p className="font-semibold text-gray-900 truncate">{plat.nom}</p>
                    {isMeilleureRenta && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        ✓ rentable
                      </span>
                    )}
                    {isAlerte && (
                      <span className="shrink-0 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                        ⚠ coût élevé
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{plat.quantite} vendus</span>
                    <span>{partCA.toFixed(0)}% du CA</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{plat.ca.toFixed(0)} €</p>
                  {plat.food_cost_pct !== null && (
                    <p
                      className={`text-xs font-medium ${
                        isAlerte
                          ? 'text-red-500'
                          : isMeilleureRenta
                            ? 'text-green-600'
                            : 'text-gray-500'
                      }`}
                    >
                      FC {plat.food_cost_pct.toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>

              {/* Barre CA */}
              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${partCA}%` }}
                />
              </div>

              {/* Marge */}
              {plat.marge > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Marge brute : {plat.marge.toFixed(0)} €
                </p>
              )}
            </div>
          )
        })}
      </div>

      {sorted.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">CA période</span>
            <span className="font-bold">{totalCA.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Plats vendus</span>
            <span className="font-bold">{sorted.reduce((s, p) => s + p.quantite, 0)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
