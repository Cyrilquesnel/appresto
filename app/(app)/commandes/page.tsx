'use client'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-500 bg-gray-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-600 bg-blue-50' },
  confirme: { label: 'Confirmé', color: 'text-green-600 bg-green-50' },
  recu: { label: 'Reçu', color: 'text-primary bg-primary/10' },
}

export default function CommandesPage() {
  const { data: bons } = trpc.commandes.listBons.useQuery()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
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
            className="px-4 py-2 bg-accent text-white rounded-xl font-medium"
            data-testid="new-commande-button"
          >
            + Nouveau
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {bons?.map((bon) => {
          const statut = STATUT_LABELS[bon.statut ?? 'brouillon']
          const fournisseur = bon.fournisseur as { nom: string } | null
          return (
            <Link key={bon.id} href={`/commandes/${bon.id}`}>
              <div
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-95 transition-transform"
                data-testid={`bon-${bon.id}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{fournisseur?.nom ?? '—'}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statut.color}`}>
                    {statut.label}
                  </span>
                </div>
                <p className="text-lg font-bold text-primary mt-1">
                  {bon.total_ht?.toFixed(2) ?? '0.00'} € HT
                </p>
                {bon.date_livraison_souhaitee && (
                  <p className="text-xs text-gray-400 mt-1">
                    Livraison souhaitée :{' '}
                    {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </Link>
          )
        })}

        {bons?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucune commande</p>
            <Link href="/commandes/nouveau" className="text-accent text-sm mt-2 block">
              Créer une commande →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
