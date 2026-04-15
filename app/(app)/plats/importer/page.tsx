'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

interface CsvRow {
  plat_nom: string
  plat_prix_vente_ht?: string
  ingredient_nom: string
  grammage: string
  unite?: string
}

interface PlatPreview {
  nom: string
  prix_vente_ht?: number
  ingredients: { nom: string; grammage: number; unite: string }[]
}

function groupRows(rows: CsvRow[]): PlatPreview[] {
  const map = new Map<string, PlatPreview>()
  for (const row of rows) {
    if (!row.plat_nom || !row.ingredient_nom || !row.grammage) continue
    if (!map.has(row.plat_nom)) {
      map.set(row.plat_nom, {
        nom: row.plat_nom,
        prix_vente_ht: row.plat_prix_vente_ht ? parseFloat(row.plat_prix_vente_ht) : undefined,
        ingredients: [],
      })
    }
    const plat = map.get(row.plat_nom)!
    plat.ingredients.push({
      nom: row.ingredient_nom,
      grammage: parseFloat(row.grammage),
      unite: row.unite ?? 'g',
    })
  }
  return Array.from(map.values()).filter((p) => p.ingredients.length > 0)
}

type ImportResult = { nom: string; success: boolean; error?: string }

export default function ImporterPage() {
  const [plats, setPlats] = useState<PlatPreview[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importBulk = trpc.fiches.importBulk.useMutation({
    onSuccess: (data) => setResults(data),
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setResults(null)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const grouped = groupRows(result.data)
        if (grouped.length === 0) {
          setParseError(
            'Aucun plat valide trouvé. Vérifiez les colonnes : plat_nom, ingredient_nom, grammage'
          )
          setPlats([])
        } else {
          setPlats(grouped)
        }
      },
      error: (err) => setParseError(err.message),
    })
  }

  if (results) {
    const success = results.filter((r) => r.success).length
    const errors = results.filter((r) => !r.success)
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/plats" className="text-gray-500 hover:text-gray-700">
            ←
          </Link>
          <h1 className="text-xl font-bold">Résultats de l&apos;import</h1>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-green-700 font-semibold">
            {success} fiche{success > 1 ? 's' : ''} importée{success > 1 ? 's' : ''} avec succès
          </p>
        </div>
        {errors.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 space-y-1">
            <p className="text-red-700 font-semibold text-sm">
              {errors.length} erreur{errors.length > 1 ? 's' : ''}
            </p>
            {errors.map((r, i) => (
              <p key={i} className="text-xs text-red-600">
                {r.nom} : {r.error}
              </p>
            ))}
          </div>
        )}
        <Link
          href="/plats"
          className="block w-full text-center py-3 bg-accent text-white font-semibold rounded-2xl"
        >
          Voir les fiches
        </Link>
        <button
          type="button"
          onClick={() => {
            setResults(null)
            setPlats([])
            if (fileRef.current) fileRef.current.value = ''
          }}
          className="block w-full text-center py-3 text-gray-500 text-sm hover:bg-gray-50 rounded-2xl"
        >
          Importer un autre fichier
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/plats" className="text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-xl font-bold">Import CSV fiches techniques</h1>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-200 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">Format attendu (CSV avec virgule) :</p>
        <code className="block text-xs">
          plat_nom,plat_prix_vente_ht,ingredient_nom,grammage,unite
        </code>
        <code className="block text-xs">Magret de canard,28,Magret de canard,200,g</code>
        <code className="block text-xs">Magret de canard,28,Sauce orange,50,ml</code>
      </div>

      <label className="block">
        <span className="sr-only">Choisir un fichier CSV</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-2xl file:border-0 file:bg-accent/5 file:text-accent file:font-semibold hover:file:bg-accent/10 cursor-pointer"
        />
      </label>

      {parseError && <p className="text-sm text-red-500">{parseError}</p>}

      {plats.length > 0 && (
        <>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {plats.map((plat, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-gray-900">{plat.nom}</p>
                  {plat.prix_vente_ht && (
                    <span className="text-xs text-gray-500">{plat.prix_vente_ht.toFixed(2)} €</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {plat.ingredients.length} ingrédient{plat.ingredients.length > 1 ? 's' : ''}
                </p>
                <div className="mt-2 space-y-1">
                  {plat.ingredients.map((ing, j) => (
                    <div key={j} className="flex justify-between text-xs text-gray-600">
                      <span>{ing.nom}</span>
                      <span>
                        {ing.grammage} {ing.unite}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => importBulk.mutate({ plats })}
            disabled={importBulk.isPending}
            className="w-full py-4 bg-accent text-white font-semibold rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
          >
            {importBulk.isPending
              ? 'Import en cours...'
              : `Importer ${plats.length} fiche${plats.length > 1 ? 's' : ''}`}
          </button>

          {importBulk.isError && (
            <p className="text-sm text-red-500 text-center">{importBulk.error.message}</p>
          )}
        </>
      )}
    </div>
  )
}
