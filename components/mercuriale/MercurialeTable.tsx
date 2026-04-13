'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

type MercurialeItem = {
  id: string
  prix: number
  unite: string
  date_maj: string
  ingredient: { id: string; nom_custom: string | null; catalog: { nom: string } | null } | null
  fournisseur: { id: string; nom: string } | null
}

function ingredientNom(item: MercurialeItem): string {
  return item.ingredient?.nom_custom ?? item.ingredient?.catalog?.nom ?? '—'
}

export function MercurialeTable() {
  const { data: mercuriale, refetch } = trpc.commandes.getMercuriale.useQuery()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPrix, setNewPrix] = useState('')

  const setPrice = trpc.commandes.setMercurialePrice.useMutation({
    onSuccess: () => {
      setEditingId(null)
      setNewPrix('')
      refetch()
    },
  })

  function startEdit(item: MercurialeItem) {
    setEditingId(item.id)
    setNewPrix(item.prix.toString())
  }

  function handlePriceSubmit(item: MercurialeItem) {
    const prix = parseFloat(newPrix)
    if (!prix || prix <= 0 || !item.ingredient || !item.fournisseur) return
    setPrice.mutate({
      ingredient_id: item.ingredient.id,
      fournisseur_id: item.fournisseur.id,
      prix,
      unite: item.unite,
    })
  }

  return (
    <div className="space-y-2" data-testid="mercuriale-table">
      {mercuriale?.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">
              {ingredientNom(item as MercurialeItem)}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {item.fournisseur?.nom ?? '—'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {editingId === item.id ? (
              <>
                <input
                  type="number"
                  value={newPrix}
                  onChange={(e) => setNewPrix(e.target.value)}
                  step="0.01"
                  min="0.01"
                  className="w-20 px-2 py-1 rounded-lg border border-accent text-sm font-mono text-right focus:outline-none"
                  autoFocus
                  data-testid={`prix-input-${item.id}`}
                />
                <span className="text-xs text-gray-500">€/{item.unite}</span>
                <button
                  onClick={() => handlePriceSubmit(item as MercurialeItem)}
                  disabled={setPrice.isPending}
                  className="text-xs text-white bg-accent px-2 py-1 rounded-lg disabled:opacity-50"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-gray-400"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {item.prix.toFixed(2)} €/{item.unite}
                </span>
                <button
                  onClick={() => startEdit(item as MercurialeItem)}
                  className="text-xs text-accent hover:underline"
                  data-testid={`edit-prix-${item.id}`}
                >
                  Modifier
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {mercuriale?.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun prix enregistré — ajoutez des prix pour calculer vos coûts de revient
        </div>
      )}
    </div>
  )
}
