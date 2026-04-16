'use client'
import { trpc } from '@/lib/trpc/client'

interface StatutActionsProps {
  bon: { id: string; statut: string }
  onUpdated: () => void
}

export function StatutActions({ bon, onUpdated }: StatutActionsProps) {
  const updateStatut = trpc.commandes.updateStatutBon.useMutation({ onSuccess: onUpdated })

  if (bon.statut === 'brouillon') return null

  if (bon.statut === 'recu') {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm font-medium">
        <span>✓ Commande reçue</span>
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-1">
      {bon.statut === 'envoye' && (
        <button
          onClick={() =>
            updateStatut.mutate({ bonId: bon.id, statut: 'confirme', envoye_via: undefined })
          }
          disabled={updateStatut.isPending}
          className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform"
        >
          {updateStatut.isPending ? '...' : 'Confirmé par le fournisseur'}
        </button>
      )}
      <button
        onClick={() =>
          updateStatut.mutate({ bonId: bon.id, statut: 'recu', envoye_via: undefined })
        }
        disabled={updateStatut.isPending}
        className="w-full py-3.5 bg-accent text-white font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform"
      >
        {updateStatut.isPending ? '...' : 'Marquer comme reçu'}
      </button>
    </div>
  )
}
