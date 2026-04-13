'use client'
import { useParams, useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { BonDeCommandePreview } from '@/components/commandes/BonDeCommandePreview'

const STATUT_SUIVANT: Record<string, string> = {
  brouillon: 'envoye',
  envoye: 'confirme',
  confirme: 'recu',
}

const STATUT_ACTION: Record<string, string> = {
  brouillon: 'Marquer comme envoyé',
  envoye: 'Marquer comme confirmé',
  confirme: 'Marquer comme reçu',
}

export default function BonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: bon, refetch } = trpc.commandes.getBon.useQuery({ bonId: id })
  const updateStatut = trpc.commandes.updateStatutBon.useMutation({
    onSuccess: () => refetch(),
  })

  if (!bon) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-center text-gray-400 py-12">Chargement...</p>
      </div>
    )
  }

  const bonTyped = bon as Parameters<typeof BonDeCommandePreview>[0]['bon']
  const prochainStatut = STATUT_SUIVANT[bon.statut ?? '']
  const actionLabel = STATUT_ACTION[bon.statut ?? '']

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Retour
        </button>
      </div>

      <BonDeCommandePreview bon={bonTyped} />

      {prochainStatut && (
        <button
          onClick={() =>
            updateStatut.mutate({
              bonId: id,
              statut: prochainStatut as 'brouillon' | 'envoye' | 'confirme' | 'recu',
            })
          }
          disabled={updateStatut.isPending}
          className="w-full py-3 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50"
          data-testid="update-statut-button"
        >
          {updateStatut.isPending ? '...' : actionLabel}
        </button>
      )}

      {bon.statut === 'brouillon' && (
        <p className="text-center text-xs text-gray-400">
          Envoyez ce bon via WhatsApp ou email depuis les actions de la Task 3.4
        </p>
      )}
    </div>
  )
}
