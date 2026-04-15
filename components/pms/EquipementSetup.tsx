'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const TYPE_DEFAULTS = {
  frigo: { nom: 'Réfrigérateur', temp_min: 0, temp_max: 4 },
  congelateur: { nom: 'Congélateur', temp_min: -25, temp_max: -18 },
  bain_marie: { nom: 'Bain-marie', temp_min: 63, temp_max: 85 },
  four: { nom: 'Four', temp_min: 0, temp_max: 300 },
  autre: { nom: 'Équipement', temp_min: 0, temp_max: 100 },
} as const

type EquipementType = keyof typeof TYPE_DEFAULTS

const TYPE_LABELS: Record<EquipementType, string> = {
  frigo: 'Frigo',
  congelateur: 'Congél.',
  bain_marie: 'Bain-marie',
  four: 'Four',
  autre: 'Autre',
}

export function EquipementSetup({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState<EquipementType>('frigo')
  const [nom, setNom] = useState<string>(TYPE_DEFAULTS.frigo.nom)
  const [tempMin, setTempMin] = useState(TYPE_DEFAULTS.frigo.temp_min.toString())
  const [tempMax, setTempMax] = useState(TYPE_DEFAULTS.frigo.temp_max.toString())
  const utils = trpc.useUtils()

  const create = trpc.pms.createEquipement.useMutation({
    onSuccess: () => {
      utils.pms.listEquipements.invalidate()
      onSuccess()
    },
  })

  const handleTypeChange = (t: EquipementType) => {
    setType(t)
    setNom(TYPE_DEFAULTS[t].nom)
    setTempMin(TYPE_DEFAULTS[t].temp_min.toString())
    setTempMax(TYPE_DEFAULTS[t].temp_max.toString())
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate({
          nom,
          type,
          temp_min: parseFloat(tempMin),
          temp_max: parseFloat(tempMax),
        })
      }}
      className="space-y-4"
      data-testid="equipement-form"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_DEFAULTS) as EquipementType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-xl text-sm font-medium border ${
                type === t
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
        placeholder="Nom de l'équipement"
        className="w-full px-4 py-3 rounded-xl border border-gray-200"
        data-testid="equipement-nom"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">T° min (°C)</label>
          <input
            type="number"
            value={tempMin}
            onChange={(e) => setTempMin(e.target.value)}
            step={0.5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center"
            data-testid="temp-min-input"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">T° max (°C)</label>
          <input
            type="number"
            value={tempMax}
            onChange={(e) => setTempMax(e.target.value)}
            step={0.5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center"
            data-testid="temp-max-input"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!nom || create.isPending}
        className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50"
      >
        {create.isPending ? 'Ajout...' : "Ajouter l'équipement"}
      </button>

      {create.isError && <p className="text-sm text-red-500 text-center">{create.error.message}</p>}
    </form>
  )
}
