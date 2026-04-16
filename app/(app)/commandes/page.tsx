'use client'
import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'

type Statut = 'brouillon' | 'envoye' | 'confirme' | 'recu'

const STATUT_LABELS: Record<Statut, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-500 bg-gray-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-600 bg-blue-50' },
  confirme: { label: 'Confirmé', color: 'text-green-600 bg-green-50' },
  recu: { label: 'Reçu', color: 'text-primary bg-primary/10' },
}

const ENVOYE_VIA_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  pdf: 'PDF',
}

const FILTERS: Array<{ value: Statut | undefined; label: string }> = [
  { value: undefined, label: 'Tous' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'envoye', label: 'Envoyé' },
  { value: 'recu', label: 'Reçu' },
]

export default function CommandesPage() {
  const [filter, setFilter] = useState<Statut | undefined>(undefined)
  const { data: bons } = trpc.commandes.listBons.useQuery(filter ? { statut: filter } : undefined)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-primary">Commandes</h1>
        <div className="flex gap-2">
          <Link
            href="/commandes/auto"
            className="px-3 py-2 rounded-xl border border-accent/30 text-accent font-medium text-sm"
          >
            Auto ✨
          </Link>
          <Link
            href="/commandes/nouveau"
            className="px-4 py-2 bg-accent text-white rounded-xl font-medium text-sm"
            data-testid="new-commande-button"
          >
            + Nouveau
          </Link>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="flex gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => setFilter(f.value)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f.value
                ? 'bg-accent text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {bons?.map((bon) => {
          const statut = STATUT_LABELS[(bon.statut as Statut) ?? 'brouillon']
          const fournisseur = bon.fournisseur as { nom: string } | null
          return (
            <Link key={bon.id} href={`/commandes/${bon.id}`}>
              <div
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-95 transition-transform"
                data-testid={`bon-${bon.id}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{fournisseur?.nom ?? '—'}</h3>
                  <div className="flex items-center gap-2">
                    {bon.envoye_via && (
                      <span className="text-xs text-gray-400">
                        {ENVOYE_VIA_LABELS[bon.envoye_via] ?? bon.envoye_via}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statut.color}`}>
                      {statut.label}
                    </span>
                  </div>
                </div>
                <p className="text-lg font-bold text-primary mt-1">
                  {bon.total_ht?.toFixed(2) ?? '0.00'} € HT
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {bon.date_livraison_souhaitee && (
                    <p className="text-xs text-gray-400">
                      Livraison :{' '}
                      {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                  <p className="text-xs text-gray-300">
                    {new Date(bon.created_at ?? '').toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}

        {bons?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucune commande{filter ? ` "${STATUT_LABELS[filter].label}"` : ''}</p>
            <Link href="/commandes/nouveau" className="text-accent text-sm mt-2 block">
              Créer une commande →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
