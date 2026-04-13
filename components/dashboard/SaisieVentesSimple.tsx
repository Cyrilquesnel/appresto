'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface SaisieVentesSimpleProps {
  onSuccess: (montant: number) => void
}

export function SaisieVentesSimple({ onSuccess }: SaisieVentesSimpleProps) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [service, setService] = useState<'midi' | 'soir'>('midi')
  const [couverts, setCouverts] = useState('')
  const [panierMoyen, setPanierMoyen] = useState('')

  const logVentes = trpc.dashboard.logVentes.useMutation({
    onSuccess: (data) => {
      onSuccess(data.montant_total)
      setCouverts('')
    },
  })

  const montantEstime = couverts && panierMoyen
    ? (parseFloat(couverts) * parseFloat(panierMoyen)).toFixed(2)
    : null

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        logVentes.mutate({
          mode: 'simple',
          date,
          service,
          nb_couverts: parseInt(couverts, 10),
          panier_moyen: parseFloat(panierMoyen),
        })
      }}
      className="space-y-4"
      data-testid="saisie-ventes-simple"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          data-testid="ventes-date"
        />
        <select
          value={service}
          onChange={e => setService(e.target.value as 'midi' | 'soir')}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          data-testid="ventes-service"
        >
          <option value="midi">Midi</option>
          <option value="soir">Soir</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nb couverts</label>
          <input
            type="number"
            value={couverts}
            onChange={e => setCouverts(e.target.value)}
            min={0}
            required
            placeholder="ex: 35"
            className="w-full px-4 py-4 text-2xl font-bold rounded-xl border border-gray-200 bg-white text-center"
            data-testid="ventes-couverts"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Panier moyen HT (€)</label>
          <input
            type="number"
            value={panierMoyen}
            onChange={e => setPanierMoyen(e.target.value)}
            min={0}
            step={0.5}
            required
            placeholder="ex: 28"
            className="w-full px-4 py-4 text-2xl font-bold rounded-xl border border-gray-200 bg-white text-center"
            data-testid="ventes-panier"
          />
        </div>
      </div>

      {montantEstime && (
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">CA estimé</p>
          <p className="text-3xl font-bold text-green-600">{montantEstime} €</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!couverts || !panierMoyen || logVentes.isPending}
        className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-ventes-button"
      >
        {logVentes.isPending ? 'Enregistrement...' : '✓ Valider les ventes'}
      </button>

      {logVentes.isError && (
        <p className="text-sm text-red-500 text-center">{logVentes.error.message}</p>
      )}
    </form>
  )
}
