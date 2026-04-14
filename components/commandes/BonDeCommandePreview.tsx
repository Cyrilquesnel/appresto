'use client'

interface LignePreview {
  id: string
  quantite: number
  unite: string
  prix_unitaire: number | null
  total_ligne: number | null
  ingredient: {
    nom_custom: string | null
    catalog: { nom: string } | null
  } | null
}

interface BonPreviewData {
  id: string
  statut: string
  total_ht: number | null
  date_livraison_souhaitee: string | null
  notes: string | null
  created_at: string
  fournisseur: {
    nom: string
    contact_whatsapp?: string | null
    contact_email?: string | null
  } | null
  lignes: LignePreview[]
}

interface BonDeCommandePreviewProps {
  bon: BonPreviewData
}

function ligneNom(ligne: LignePreview): string {
  return ligne.ingredient?.nom_custom ?? ligne.ingredient?.catalog?.nom ?? '—'
}

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-500 bg-gray-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-600 bg-blue-50' },
  confirme: { label: 'Confirmé', color: 'text-green-600 bg-green-50' },
  recu: { label: 'Reçu', color: 'text-primary bg-primary/10' },
}

export function BonDeCommandePreview({ bon }: BonDeCommandePreviewProps) {
  const statut = STATUT_LABELS[bon.statut] ?? STATUT_LABELS.brouillon

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4"
      data-testid="bon-preview"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 text-base">{bon.fournisseur?.nom ?? '—'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(bon.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statut.color}`}>
          {statut.label}
        </span>
      </div>

      {bon.date_livraison_souhaitee && (
        <p className="text-sm text-gray-600">
          Livraison souhaitée :{' '}
          <span className="font-medium">
            {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
          </span>
        </p>
      )}

      <div className="divide-y divide-gray-100">
        {bon.lignes.map((ligne) => (
          <div key={ligne.id} className="py-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-800 flex-1 truncate">{ligneNom(ligne)}</span>
            <span className="text-gray-500 font-mono flex-shrink-0">
              {ligne.quantite} {ligne.unite}
            </span>
            {ligne.prix_unitaire != null && (
              <span className="text-gray-700 font-mono flex-shrink-0 w-20 text-right">
                {(ligne.total_ligne ?? ligne.quantite * ligne.prix_unitaire).toFixed(2)} €
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Total HT</span>
        <span className="font-bold text-primary text-lg">
          {bon.total_ht?.toFixed(2) ?? '0.00'} €
        </span>
      </div>

      {bon.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">{bon.notes}</p>}
    </div>
  )
}
