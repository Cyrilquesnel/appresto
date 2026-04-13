'use client'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { FoodCostCard } from '@/components/dashboard/FoodCostCard'
import { SeuilRentabiliteCard } from '@/components/dashboard/SeuilRentabiliteCard'
import { ChargesCard } from '@/components/dashboard/ChargesCard'
import { VentesSemaineChart } from '@/components/dashboard/VentesSemaineChart'
import { RealtimeIndicator } from '@/components/dashboard/RealtimeIndicator'
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime'

export default function DashboardPage() {
  useDashboardRealtime()

  const { data: kpis, isLoading } = trpc.dashboard.get.useQuery({ periode: 'mois' })
  const { data: semaine } = trpc.dashboard.getVentesSemaine.useQuery()

  const moisCourant = new Date().toISOString().slice(0, 7)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <RealtimeIndicator />
          <span className="text-xs text-gray-400">Ce mois-ci</span>
        </div>
      </div>

      {/* CA total */}
      <div className="bg-indigo-700 rounded-2xl p-5 text-white" data-testid="ca-card">
        <p className="text-xs opacity-70 uppercase tracking-wide">Chiffre d&apos;affaires HT</p>
        <p className="text-4xl font-bold mt-1" data-testid="ca-value">
          {kpis?.ca_total.toFixed(2) ?? '0.00'} €
        </p>
        <div className="flex gap-4 mt-2 text-sm opacity-70">
          {kpis?.nb_couverts != null && kpis.nb_couverts > 0 && (
            <span>{kpis.nb_couverts} couverts</span>
          )}
          {kpis?.panier_moyen != null && (
            <span>{kpis.panier_moyen.toFixed(0)} €/couvert</span>
          )}
        </div>
      </div>

      {/* Graphique 7 jours */}
      {semaine && semaine.some(d => d.montant > 0) && (
        <VentesSemaineChart data={semaine} />
      )}

      {/* Food Cost */}
      <FoodCostCard
        pct={kpis?.food_cost_pct ?? null}
        euros={kpis?.food_cost_euros ?? null}
        ca={kpis?.ca_total ?? 0}
      />

      {/* Seuil rentabilité */}
      <SeuilRentabiliteCard
        seuil={kpis?.seuil_rentabilite ?? null}
        ca={kpis?.ca_total ?? 0}
        chargesFixes={kpis?.charges_fixes ?? null}
      />

      {/* Charges */}
      <ChargesCard
        mois={moisCourant}
        masse_salariale={kpis?.masse_salariale ?? null}
        charges_fixes={kpis?.charges_fixes ?? null}
      />

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/saisie-ventes"
          className="bg-indigo-600 text-white rounded-2xl p-4 text-center font-semibold"
          data-testid="btn-saisie-ventes"
        >
          + Saisir ventes
        </Link>
        <Link
          href="/plats/nouveau"
          className="bg-white border border-gray-200 text-gray-900 rounded-2xl p-4 text-center font-semibold"
        >
          + Nouveau plat
        </Link>
      </div>
    </div>
  )
}
