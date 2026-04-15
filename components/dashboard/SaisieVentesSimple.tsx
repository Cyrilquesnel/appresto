'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type Periode = 'jour' | 'semaine' | 'mois'

interface SaisieVentesSimpleProps {
  onSuccess: (montant: number) => void
}

function getWeekRange(anyDate: string): string[] {
  const d = new Date(anyDate)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd.toISOString().split('T')[0]
  })
}

function getMonthRange(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${yearMonth}-${d}`
  })
}

export function SaisieVentesSimple({ onSuccess }: SaisieVentesSimpleProps) {
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = today.slice(0, 7)

  const [periode, setPeriode] = useState<Periode>('jour')
  const [date, setDate] = useState(today)
  const [mois, setMois] = useState(thisMonth)
  const [service, setService] = useState<'midi' | 'soir' | 'continu'>('midi')
  const [couverts, setCouverts] = useState('')
  const [panierMoyen, setPanierMoyen] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const logVentes = trpc.dashboard.logVentes.useMutation()

  const days =
    periode === 'semaine' ? getWeekRange(date) : periode === 'mois' ? getMonthRange(mois) : [date]

  const montantTotal =
    couverts && panierMoyen ? parseFloat(couverts) * parseFloat(panierMoyen) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const nbCouverts = parseInt(couverts, 10)
    const pm = parseFloat(panierMoyen)
    if (!nbCouverts || !pm) return

    if (periode === 'jour') {
      const result = await logVentes.mutateAsync({
        mode: 'simple',
        date,
        service,
        nb_couverts: nbCouverts,
        panier_moyen: pm,
      })
      onSuccess(result.montant_total)
      setCouverts('')
      return
    }

    // Multi-day: divide couverts evenly across each day
    setSubmitting(true)
    try {
      const couvertsParJour = Math.round(nbCouverts / days.length)
      let totalMontant = 0
      for (const day of days) {
        const result = await logVentes.mutateAsync({
          mode: 'simple',
          date: day,
          service,
          nb_couverts: couvertsParJour,
          panier_moyen: pm,
        })
        totalMontant += result.montant_total
      }
      onSuccess(totalMontant)
      setCouverts('')
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = submitting || logVentes.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="saisie-ventes-simple">
      {/* Sélecteur période */}
      <div className="flex gap-2">
        {(['jour', 'semaine', 'mois'] as Periode[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriode(p)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              periode === p ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {periode === 'mois' ? (
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          />
        ) : (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
            data-testid="ventes-date"
          />
        )}
        <select
          value={service}
          onChange={(e) => setService(e.target.value as typeof service)}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
          data-testid="ventes-service"
        >
          <option value="midi">Midi</option>
          <option value="soir">Soir</option>
          {periode !== 'jour' && <option value="continu">Continu</option>}
        </select>
      </div>

      {periode !== 'jour' && (
        <p className="text-xs text-gray-400 text-center">
          {days.length} jours — les couverts seront répartis uniformément
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {periode === 'jour' ? 'Nb couverts' : 'Couverts total période'}
          </label>
          <input
            type="number"
            value={couverts}
            onChange={(e) => setCouverts(e.target.value)}
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
            onChange={(e) => setPanierMoyen(e.target.value)}
            min={0}
            step={0.5}
            required
            placeholder="ex: 28"
            className="w-full px-4 py-4 text-2xl font-bold rounded-xl border border-gray-200 bg-white text-center"
            data-testid="ventes-panier"
          />
        </div>
      </div>

      {montantTotal !== null && (
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">
            CA estimé {periode !== 'jour' ? `(${days.length} jours)` : ''}
          </p>
          <p className="text-3xl font-bold text-green-600">{montantTotal.toFixed(2)} €</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!couverts || !panierMoyen || isLoading}
        className="w-full py-4 bg-accent text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-ventes-button"
      >
        {isLoading ? 'Enregistrement...' : '✓ Valider les ventes'}
      </button>

      {(submitError ?? logVentes.error) && (
        <p className="text-sm text-red-500 text-center">
          {submitError ?? logVentes.error?.message}
        </p>
      )}
    </form>
  )
}
