'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface ReceptionItem {
  ingredient_id?: string
  nom_produit: string
  quantite: number
  unite: string
  dlc?: string
  numero_lot?: string
  temperature_reception?: number
  conforme: boolean
  anomalie_description?: string
}

interface ReceptionFormProps {
  initialItems?: ReceptionItem[]
  fournisseurId?: string
  onSuccess: (id: string) => void
}

export function ReceptionForm({ initialItems = [], fournisseurId, onSuccess }: ReceptionFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedFournisseur, setSelectedFournisseur] = useState(fournisseurId ?? '')
  const [dateReception, setDateReception] = useState(today)
  const [numeroBL, setNumeroBL] = useState('')
  const [items, setItems] = useState<ReceptionItem[]>(
    initialItems.length > 0
      ? initialItems
      : [{ nom_produit: '', quantite: 1, unite: 'kg', conforme: true }]
  )

  const { data: fournisseurs } = trpc.commandes.listFournisseurs.useQuery()
  const createReception = trpc.pms.createReception.useMutation({
    onSuccess: (data) => onSuccess(data.id),
  })

  const updateItem = (index: number, updates: Partial<ReceptionItem>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...updates } : item)))
  }

  const addItem = () => {
    setItems((prev) => [...prev, { nom_produit: '', quantite: 1, unite: 'kg', conforme: true }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const isDLCAlerte = (dlc?: string) => {
    if (!dlc) return false
    return new Date(dlc) <= new Date()
  }

  const canSubmit =
    selectedFournisseur && items.length > 0 && items.every((i) => i.nom_produit.trim())

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createReception.mutate({
          fournisseur_id: selectedFournisseur,
          date_reception: dateReception,
          numero_bl: numeroBL || undefined,
          items: items.filter((i) => i.nom_produit.trim()),
        })
      }}
      className="space-y-4"
      data-testid="reception-form"
    >
      <select
        value={selectedFournisseur}
        onChange={(e) => setSelectedFournisseur(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white"
      >
        <option value="">Sélectionner un fournisseur</option>
        {fournisseurs?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nom}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={dateReception}
          onChange={(e) => setDateReception(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200"
        />
        <input
          type="text"
          value={numeroBL}
          onChange={(e) => setNumeroBL(e.target.value)}
          placeholder="N° bon de livraison"
          className="px-4 py-3 rounded-xl border border-gray-200"
        />
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={`rounded-2xl p-4 border ${item.conforme ? 'border-gray-200 bg-white' : 'border-red-300 bg-red-50'}`}
            data-testid={`reception-item-${index}`}
          >
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={item.nom_produit}
                onChange={(e) => updateItem(index, { nom_produit: e.target.value })}
                placeholder="Nom du produit *"
                required
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm mr-2"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-400 text-lg"
                >
                  ×
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500">DLC</label>
                <input
                  type="date"
                  value={item.dlc ?? ''}
                  onChange={(e) => updateItem(index, { dlc: e.target.value })}
                  className={`w-full px-2 py-1 text-sm rounded-lg border ${isDLCAlerte(item.dlc) ? 'border-red-400 text-red-600' : 'border-gray-200'}`}
                  data-testid={`item-dlc-${index}`}
                />
                {isDLCAlerte(item.dlc) && (
                  <p className="text-red-500 text-xs mt-1" data-testid={`dlc-alerte-${index}`}>
                    ⚠ DLC dépassée !
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">N° lot</label>
                <input
                  type="text"
                  value={item.numero_lot ?? ''}
                  onChange={(e) => updateItem(index, { numero_lot: e.target.value })}
                  placeholder="LOT123"
                  className="w-full px-2 py-1 text-sm rounded-lg border border-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">T° (°C)</label>
                <input
                  type="number"
                  value={item.temperature_reception ?? ''}
                  onChange={(e) =>
                    updateItem(index, {
                      temperature_reception: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  step={0.5}
                  className="w-20 px-2 py-1 text-sm rounded-lg border border-gray-200 text-center"
                />
              </div>
              <label className="flex items-center gap-1 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={item.conforme}
                  onChange={(e) =>
                    updateItem(index, {
                      conforme: e.target.checked,
                      anomalie_description: e.target.checked
                        ? undefined
                        : item.anomalie_description,
                    })
                  }
                  className="w-5 h-5"
                  data-testid={`item-conforme-${index}`}
                />
                <span className="text-sm font-medium">Conforme</span>
              </label>
            </div>

            {!item.conforme && (
              <textarea
                value={item.anomalie_description ?? ''}
                onChange={(e) => updateItem(index, { anomalie_description: e.target.value })}
                placeholder="Décrire l'anomalie constatée (obligatoire) *"
                required
                className="w-full mt-2 px-3 py-2 text-sm rounded-xl border border-red-300"
                rows={2}
                data-testid={`item-anomalie-${index}`}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="w-full py-2 bg-gray-100 text-gray-600 font-medium rounded-xl text-sm"
      >
        + Ajouter un produit
      </button>

      <button
        type="submit"
        disabled={!canSubmit || createReception.isPending}
        className="w-full py-4 bg-indigo-700 text-white font-semibold rounded-2xl disabled:opacity-50"
        data-testid="save-reception-button"
      >
        {createReception.isPending ? 'Enregistrement...' : 'Enregistrer la réception'}
      </button>

      {createReception.isError && (
        <p className="text-sm text-red-500 text-center">{createReception.error.message}</p>
      )}
    </form>
  )
}
