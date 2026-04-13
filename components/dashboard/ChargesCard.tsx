'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface ChargesCardProps {
  mois: string
  masse_salariale: number | null
  charges_fixes: number | null
}

export function ChargesCard({ mois, masse_salariale, charges_fixes }: ChargesCardProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    masse_salariale: '',
    loyer: '',
    energie: '',
    assurances: '',
    autres_charges: '',
  })

  const saveCharges = trpc.dashboard.saveCharges.useMutation({
    onSuccess: () => setOpen(false),
  })
  const utils = trpc.useUtils()

  function handleSave() {
    saveCharges.mutate(
      {
        mois,
        masse_salariale: form.masse_salariale ? parseFloat(form.masse_salariale) : undefined,
        loyer: form.loyer ? parseFloat(form.loyer) : undefined,
        energie: form.energie ? parseFloat(form.energie) : undefined,
        assurances: form.assurances ? parseFloat(form.assurances) : undefined,
        autres_charges: form.autres_charges ? parseFloat(form.autres_charges) : undefined,
      },
      { onSuccess: () => utils.dashboard.get.invalidate() }
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100" data-testid="charges-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="text-left">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Charges du mois</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">
            {charges_fixes != null ? `${charges_fixes.toFixed(0)} €` : 'Non renseigné'}
          </p>
          {masse_salariale != null && (
            <p className="text-xs text-gray-400">
              dont {masse_salariale.toFixed(0)} € masse salariale
            </p>
          )}
        </div>
        <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {[
            { key: 'masse_salariale', label: 'Masse salariale' },
            { key: 'loyer', label: 'Loyer' },
            { key: 'energie', label: 'Énergie' },
            { key: 'assurances', label: 'Assurances' },
            { key: 'autres_charges', label: 'Autres charges' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-36 shrink-0">{label}</label>
              <input
                type="number"
                min={0}
                step={10}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="0 €"
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveCharges.isPending}
            className="w-full mt-2 py-2 bg-indigo-600 text-white font-medium rounded-xl text-sm disabled:opacity-50"
          >
            {saveCharges.isPending ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}
