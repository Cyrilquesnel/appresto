'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

export default function ExportPage() {
  const [mois, setMois] = useState(12)
  const [loading, setLoading] = useState(false)
  const { data } = trpc.pms.getDDPPData.useQuery({ mois })

  const generatePDF = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ddpp-export', data }),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `registre-haccp-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Export DDPP</h1>
      <p className="text-sm text-gray-500 mb-6">Registre HACCP pour les contrôles sanitaires</p>

      {/* Mode Inspecteur — 1 TAP */}
      <button
        onClick={generatePDF}
        disabled={loading || !data}
        className="w-full py-6 bg-red-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 shadow-lg mb-6"
        data-testid="mode-inspecteur-button"
      >
        {loading ? '⏳ Génération...' : '🔍 Mode Inspecteur — Télécharger le registre'}
      </button>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Paramètres</h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-600">Période:</label>
          <select
            value={mois}
            onChange={(e) => setMois(parseInt(e.target.value, 10))}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white"
          >
            <option value={1}>1 mois</option>
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent">{data?.temperatures.length ?? 0}</p>
            <p className="text-xs text-gray-400">Relevés T°</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent">{data?.checklists.length ?? 0}</p>
            <p className="text-xs text-gray-400">Checklists</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent">{data?.receptions.length ?? 0}</p>
            <p className="text-xs text-gray-400">Réceptions</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent">{data?.haccp.length ?? 0}</p>
            <p className="text-xs text-gray-400">Points CCP</p>
          </div>
        </div>
      </div>
    </div>
  )
}
