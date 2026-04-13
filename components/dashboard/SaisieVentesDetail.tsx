'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface Ligne {
  plat_id: string
  quantite: number
  prix_vente: number
}

interface SaisieVentesDetailProps {
  onSuccess: (montant: number) => void
}

export function SaisieVentesDetail({ onSuccess }: SaisieVentesDetailProps) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [service, setService] = useState<'midi' | 'soir'>('midi')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [selectedPlatId, setSelectedPlatId] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [prixVente, setPrixVente] = useState('')

  const { data: plats } = trpc.plats.list.useQuery()
  const logVentes = trpc.dashboard.logVentes.useMutation({
    onSuccess: (data) => {
      onSuccess(data.montant_total)
      setLignes([])
    },
  })

  const totalEstime = lignes.reduce((sum, l) => sum + l.quantite * l.prix_vente, 0)

  function addLigne() {
    if (!selectedPlatId || !prixVente) return
    const existing = lignes.findIndex(l => l.plat_id === selectedPlatId)
    if (existing >= 0) {
      const updated = [...lignes]
      updated[existing].quantite += parseInt(quantite, 10)
      setLignes(updated)
    } else {
      setLignes(prev => [...prev, {
        plat_id: selectedPlatId,
        quantite: parseInt(quantite, 10),
        prix_vente: parseFloat(prixVente),
      }])
    }
    setSelectedPlatId('')
    setQuantite('1')
    setPrixVente('')
  }

  function removeLigne(index: number) {
    setLignes(prev => prev.filter((_, i) => i !== index))
  }

  const platsMap = Object.fromEntries((plats ?? []).map(p => [p.id, p.nom]))

  return (
    <div className="space-y-4" data-testid="saisie-ventes-detail">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
        />
        <select
          value={service}
          onChange={e => setService(e.target.value as 'midi' | 'soir')}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
        >
          <option value="midi">Midi</option>
          <option value="soir">Soir</option>
        </select>
      </div>

      {/* Ajout plat */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ajouter un plat</p>
        <select
          value={selectedPlatId}
          onChange={e => setSelectedPlatId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
        >
          <option value="">Choisir un plat...</option>
          {plats?.map(p => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={quantite}
            onChange={e => setQuantite(e.target.value)}
            min={1}
            placeholder="Qté"
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          />
          <input
            type="number"
            value={prixVente}
            onChange={e => setPrixVente(e.target.value)}
            min={0}
            step={0.5}
            placeholder="Prix vente €"
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={addLigne}
          disabled={!selectedPlatId || !prixVente}
          className="w-full py-2 bg-gray-200 text-gray-700 font-medium rounded-lg text-sm disabled:opacity-50"
        >
          + Ajouter
        </button>
      </div>

      {/* Lignes ajoutées */}
      {lignes.length > 0 && (
        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100">
              <div>
                <p className="font-medium text-sm">{platsMap[l.plat_id] ?? 'Plat'}</p>
                <p className="text-xs text-gray-400">{l.quantite} × {l.prix_vente.toFixed(2)} €</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{(l.quantite * l.prix_vente).toFixed(2)} €</span>
                <button onClick={() => removeLigne(i)} className="text-red-400 text-lg leading-none">×</button>
              </div>
            </div>
          ))}
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-green-600">{totalEstime.toFixed(2)} €</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (lignes.length === 0) return
          logVentes.mutate({ mode: 'detail', date, service, lignes })
        }}
        disabled={lignes.length === 0 || logVentes.isPending}
        className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-ventes-button"
      >
        {logVentes.isPending ? 'Enregistrement...' : '✓ Valider les ventes'}
      </button>
    </div>
  )
}
