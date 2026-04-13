'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'

interface LigneForm {
  ingredient_id: string
  nom: string
  quantite: number
  unite: string
  prix_unitaire: number
}

function ingredientNom(item: {
  ingredient: { nom_custom: string | null; catalog: { nom: string } | null } | null
}): string {
  return item.ingredient?.nom_custom ?? item.ingredient?.catalog?.nom ?? '—'
}

export default function NouveauBonPage() {
  const router = useRouter()
  const [selectedFournisseur, setSelectedFournisseur] = useState('')
  const [dateLivraison, setDateLivraison] = useState('')
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState<LigneForm[]>([])

  const { data: fournisseurs } = trpc.commandes.listFournisseurs.useQuery()
  const { data: mercuriale } = trpc.commandes.getMercuriale.useQuery()
  const generateBon = trpc.commandes.generateBonDeCommande.useMutation({
    onSuccess: ({ bon_id }) => router.push(`/commandes/${bon_id}`),
  })

  const mercurialeFiltered = selectedFournisseur
    ? mercuriale?.filter((m) => (m.fournisseur as { id: string } | null)?.id === selectedFournisseur)
    : mercuriale

  function addLigne(item: typeof mercuriale extends (infer T)[] | undefined ? T : never) {
    const ingId = (item.ingredient as { id: string } | null)?.id
    if (!ingId || lignes.find((l) => l.ingredient_id === ingId)) return
    setLignes((prev) => [
      ...prev,
      {
        ingredient_id: ingId,
        nom: ingredientNom(item as Parameters<typeof ingredientNom>[0]),
        quantite: 1,
        unite: item.unite,
        prix_unitaire: item.prix,
      },
    ])
  }

  function updateQuantite(idx: number, val: string) {
    const q = parseFloat(val)
    if (q > 0) setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, quantite: q } : l)))
  }

  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalEstime = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  function handleSubmit() {
    if (!selectedFournisseur || lignes.length === 0) return
    generateBon.mutate({
      fournisseur_id: selectedFournisseur,
      date_livraison_souhaitee: dateLivraison || undefined,
      notes: notes || undefined,
      lignes: lignes.map(({ ingredient_id, quantite, unite, prix_unitaire }) => ({
        ingredient_id,
        quantite,
        unite,
        prix_unitaire,
      })),
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-6">Nouveau bon de commande</h1>

      <div className="space-y-4">
        <select
          value={selectedFournisseur}
          onChange={(e) => { setSelectedFournisseur(e.target.value); setLignes([]) }}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white"
          data-testid="fournisseur-select"
        >
          <option value="">Sélectionner un fournisseur</option>
          {fournisseurs?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateLivraison}
          onChange={(e) => setDateLivraison(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200"
        />

        {mercurialeFiltered && mercurialeFiltered.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Produits disponibles ({selectedFournisseur ? 'ce fournisseur' : 'tous'}) :
            </h3>
            <div className="space-y-1">
              {mercurialeFiltered.map((item) => {
                const ingId = (item.ingredient as { id: string } | null)?.id
                const alreadyAdded = lignes.some((l) => l.ingredient_id === ingId)
                return (
                  <button
                    key={item.id}
                    onClick={() => addLigne(item)}
                    disabled={alreadyAdded}
                    className="w-full text-left px-3 py-2 bg-gray-50 rounded-xl hover:bg-gray-100 disabled:opacity-40 flex justify-between items-center text-sm"
                  >
                    <span>{ingredientNom(item as Parameters<typeof ingredientNom>[0])}</span>
                    <span className="text-gray-500 font-mono">
                      {item.prix.toFixed(2)} €/{item.unite}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {lignes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Lignes de commande :</h3>
            <div className="space-y-2">
              {lignes.map((ligne, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200"
                >
                  <span className="flex-1 text-sm truncate">{ligne.nom}</span>
                  <input
                    type="number"
                    value={ligne.quantite}
                    onChange={(e) => updateQuantite(i, e.target.value)}
                    min="0.1"
                    step="0.5"
                    className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm font-mono"
                    data-testid={`ligne-quantite-${i}`}
                  />
                  <span className="text-xs text-gray-500 w-8">{ligne.unite}</span>
                  <span className="text-xs font-mono text-gray-700 w-16 text-right">
                    {(ligne.quantite * ligne.prix_unitaire).toFixed(2)} €
                  </span>
                  <button
                    onClick={() => removeLigne(i)}
                    className="text-red-400 text-sm hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 rounded-xl p-3 mt-3">
              <p className="text-sm font-semibold text-primary">
                Total estimé : {totalEstime.toFixed(2)} € HT
              </p>
            </div>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none"
        />

        {generateBon.error && (
          <p className="text-sm text-red-500">{generateBon.error.message}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedFournisseur || lignes.length === 0 || generateBon.isPending}
          className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50"
          data-testid="save-bon-button"
        >
          {generateBon.isPending ? 'Création...' : 'Créer le bon de commande'}
        </button>
      </div>
    </div>
  )
}
