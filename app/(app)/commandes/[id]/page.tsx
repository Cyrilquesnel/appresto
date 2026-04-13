'use client'
import { useParams, useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { BonDeCommandePreview } from '@/components/commandes/BonDeCommandePreview'
import { SendBonOptions } from '@/components/commandes/SendBonOptions'
import type { BonDeCommandeData } from '@/lib/whatsapp'

export default function BonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: bon, refetch } = trpc.commandes.getBon.useQuery({ bonId: id })

  if (!bon) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-center text-gray-400 py-12">Chargement...</p>
      </div>
    )
  }

  const bonTyped = bon as Parameters<typeof BonDeCommandePreview>[0]['bon']
  const fournisseur = bon.fournisseur as {
    nom: string
    contact_whatsapp: string | null
    contact_email: string | null
  } | null

  // Construire BonDeCommandeData pour SendBonOptions
  type LigneRow = {
    quantite: number
    unite: string
    prix_unitaire: number | null
    ingredient: { nom_custom: string | null; catalog: { nom: string } | null } | null
  }
  const lignes = ((bon.lignes ?? []) as LigneRow[]).map((l) => ({
    nom_produit: l.ingredient?.nom_custom ?? l.ingredient?.catalog?.nom ?? 'Produit',
    quantite: l.quantite,
    unite: l.unite,
    prix_unitaire: l.prix_unitaire ?? undefined,
  }))

  const bonData: BonDeCommandeData & { id: string } = {
    id: bon.id,
    fournisseur: {
      nom: fournisseur?.nom ?? '',
      contact_whatsapp: fournisseur?.contact_whatsapp,
    },
    date_livraison_souhaitee: bon.date_livraison_souhaitee,
    lignes,
    total_ht: bon.total_ht ?? 0,
    notes: bon.notes,
    restaurant_nom: '', // rempli côté serveur dans la route API
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <button
        onClick={() => router.back()}
        className="text-gray-400 hover:text-gray-600 text-sm"
      >
        ← Retour
      </button>

      <BonDeCommandePreview bon={bonTyped} />

      {bon.statut === 'brouillon' && (
        <SendBonOptions
          bon={bonData}
          onSent={() => refetch()}
        />
      )}

      {bon.statut !== 'brouillon' && (
        <div className="text-center text-sm text-gray-400 py-2">
          Bon {bon.statut === 'envoye' ? 'envoyé' : bon.statut === 'confirme' ? 'confirmé' : 'reçu'}
          {bon.envoye_via ? ` via ${bon.envoye_via}` : ''}
        </div>
      )}
    </div>
  )
}
