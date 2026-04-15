'use client'
import { useState, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import Papa from 'papaparse'

const TEMPLATE_CSV = `date,service,nb_couverts,panier_moyen,notes
2024-01-15,midi,28,26.50,Service du midi
2024-01-15,soir,42,38.00,
2024-01-16,midi,22,24.00,`

const CAISSES = [
  { nom: "L'Addition", export: 'Exports → Rapport de ventes → CSV' },
  { nom: 'Zelty', export: 'Rapports → Ventes par service → Exporter CSV' },
  { nom: 'Tiller (SumUp)', export: 'Analytiques → Ventes → Télécharger CSV' },
  { nom: 'Lightspeed', export: 'Rapports → Ventes → Exporter en CSV' },
  { nom: 'Cashpad', export: 'Gestion → Statistiques → Export CSV' },
  { nom: 'Innovorder', export: 'Tableau de bord → Exports → Ventes CSV' },
]

interface ParsedRow {
  date: string
  service: 'midi' | 'soir' | 'continu'
  nb_couverts: number
  panier_moyen: number
  notes?: string
  _valid: boolean
  _error?: string
}

function parseRow(raw: Record<string, string>, index: number): ParsedRow {
  const date = raw['date']?.trim()
  const service = (raw['service']?.trim().toLowerCase() || 'midi') as 'midi' | 'soir' | 'continu'
  const nb_couverts = parseInt(raw['nb_couverts'] ?? '0', 10)
  const panier_moyen = parseFloat(raw['panier_moyen'] ?? '0')
  const notes = raw['notes']?.trim() || undefined

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return {
      date,
      service,
      nb_couverts,
      panier_moyen,
      notes,
      _valid: false,
      _error: `Ligne ${index + 2}: date invalide (format YYYY-MM-DD)`,
    }
  if (!['midi', 'soir', 'continu'].includes(service))
    return {
      date,
      service,
      nb_couverts,
      panier_moyen,
      notes,
      _valid: false,
      _error: `Ligne ${index + 2}: service invalide (midi/soir/continu)`,
    }
  if (isNaN(nb_couverts) || nb_couverts < 0)
    return {
      date,
      service,
      nb_couverts,
      panier_moyen,
      notes,
      _valid: false,
      _error: `Ligne ${index + 2}: nb_couverts invalide`,
    }
  if (isNaN(panier_moyen) || panier_moyen < 0)
    return {
      date,
      service,
      nb_couverts,
      panier_moyen,
      notes,
      _valid: false,
      _error: `Ligne ${index + 2}: panier_moyen invalide`,
    }

  return { date, service, nb_couverts, panier_moyen, notes, _valid: true }
}

export default function ImporterVentesPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [done, setDone] = useState(false)

  const importMutation = trpc.dashboard.importVentes.useMutation({
    onSuccess: () => setDone(true),
  })

  const handleFile = (file: File) => {
    setFileName(file.name)
    setDone(false)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row, i) => parseRow(row, i))
        setRows(parsed)
      },
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const validRows = rows.filter((r) => r._valid)
  const errors = rows.filter((r) => !r._valid)

  const handleImport = () => {
    importMutation.mutate({
      lignes: validRows.map((r) => ({
        date: r.date,
        service: r.service,
        nb_couverts: r.nb_couverts,
        panier_moyen: r.panier_moyen,
        notes: r.notes,
      })),
    })
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele-ventes-lerush.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <h1 className="text-xl font-bold mb-1">Importer des ventes</h1>
      <p className="text-sm text-gray-500 mb-6">
        Compatible avec L&apos;Addition, Zelty, Tiller, Lightspeed, Cashpad, Innovorder
      </p>

      {/* Template download */}
      <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-primary text-sm">Modèle CSV vierge</p>
            <p className="text-xs text-accent mt-0.5">
              Colonnes : date, service (midi/soir/continu), nb_couverts, panier_moyen, notes
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="shrink-0 px-3 py-2 bg-accent text-white text-sm font-medium rounded-lg"
          >
            ↓ Télécharger
          </button>
        </div>
      </div>

      {/* Export instructions per caisse */}
      <details className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
        <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer bg-gray-50 select-none">
          Comment exporter depuis ma caisse ?
        </summary>
        <div className="divide-y divide-gray-100">
          {CAISSES.map((c) => (
            <div key={c.nom} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-800">{c.nom}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.export}</p>
            </div>
          ))}
        </div>
      </details>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-accent/60 transition-colors mb-6"
      >
        <p className="text-3xl mb-2">📂</p>
        <p className="font-medium text-gray-700">
          {fileName || 'Glissez votre CSV ici ou cliquez pour choisir'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Fichier .csv uniquement</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {/* Preview */}
      {rows.length > 0 && !done && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              {validRows.length} ligne{validRows.length > 1 ? 's' : ''} valide
              {validRows.length > 1 ? 's' : ''}
              {errors.length > 0 && (
                <span className="ml-2 text-red-500">
                  · {errors.length} erreur{errors.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              CA total estimé :{' '}
              {validRows.reduce((s, r) => s + r.nb_couverts * r.panier_moyen, 0).toFixed(2)} €
            </p>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              {errors.map((r, i) => (
                <p key={i} className="text-xs text-red-600">
                  {r._error}
                </p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Service</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Couverts</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Panier moy.</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validRows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 capitalize">{r.service}</td>
                    <td className="px-3 py-2 text-right">{r.nb_couverts}</td>
                    <td className="px-3 py-2 text-right">{r.panier_moyen.toFixed(2)} €</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {(r.nb_couverts * r.panier_moyen).toFixed(2)} €
                    </td>
                  </tr>
                ))}
                {validRows.length > 20 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-center text-gray-400">
                      + {validRows.length - 20} lignes supplémentaires
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={validRows.length === 0 || importMutation.isPending}
            className="mt-4 w-full py-4 bg-green-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
          >
            {importMutation.isPending
              ? 'Import en cours...'
              : `Importer ${validRows.length} ligne${validRows.length > 1 ? 's' : ''}`}
          </button>

          {importMutation.isError && (
            <p className="mt-2 text-red-600 text-sm text-center">
              Erreur : {importMutation.error.message}
            </p>
          )}
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-semibold text-green-800">
            {validRows.length} ligne{validRows.length > 1 ? 's' : ''} importée
            {validRows.length > 1 ? 's' : ''} avec succès
          </p>
          <p className="text-sm text-green-600 mt-1">
            CA ajouté :{' '}
            {validRows.reduce((s, r) => s + r.nb_couverts * r.panier_moyen, 0).toFixed(2)} €
          </p>
          <button
            onClick={() => {
              setRows([])
              setFileName('')
              setDone(false)
            }}
            className="mt-4 text-sm text-green-700 underline"
          >
            Importer un autre fichier
          </button>
        </div>
      )}
    </div>
  )
}
