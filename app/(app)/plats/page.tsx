'use client'
import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { ComingSoonFeature } from '@/components/ui/ComingSoonFeature'

type Statut = 'tous' | 'actif' | 'brouillon'

const FILTRES: { value: Statut; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'actif', label: 'Actifs' },
  { value: 'brouillon', label: 'Brouillons' },
]

export default function PlatsPage() {
  const [filtre, setFiltre] = useState<Statut>('tous')
  const { data: plats, isLoading } = trpc.plats.list.useQuery()

  const platsFiltres = (plats ?? []).filter((p) => {
    if (filtre === 'tous') return true
    return p.statut === filtre
  })

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Mes plats</h1>
        <div className="flex gap-2">
          <Link
            href="/plats/allergenes"
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Allergènes
          </Link>
          <Link
            href="/plats/importer"
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Import CSV
          </Link>
          <ComingSoonFeature>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700"
            >
              🎤 Vocal
            </button>
          </ComingSoonFeature>
          <Link
            href="/plats/nouveau"
            className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-accent"
            data-testid="add-dish-btn"
          >
            + Nouveau
          </Link>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-medium mb-4">
        {FILTRES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltre(f.value)}
            className={`flex-1 py-2 transition-colors ${
              filtre === f.value
                ? 'bg-accent text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-accent rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && platsFiltres.length === 0 && (
        <p className="text-gray-500 text-center mt-8">
          {filtre === 'tous'
            ? 'Aucun plat — photographiez votre premier plat !'
            : `Aucun plat en statut "${filtre}"`}
        </p>
      )}

      {platsFiltres.map((plat) => (
        <Link
          key={plat.id}
          href={`/plats/${plat.id}`}
          className="block border rounded-xl p-3 mb-3 hover:border-accent/30 transition-colors"
        >
          <div className="flex justify-between items-start">
            <span className="font-medium">{plat.nom}</span>
            {plat.cout_de_revient && (
              <span className="text-sm text-gray-500">{plat.cout_de_revient.toFixed(2)} €</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                plat.statut === 'actif'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {plat.statut === 'actif' ? 'Actif' : 'Brouillon'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
