'use client'
import { useState } from 'react'
import type { FicheTechniqueData } from '@/components/pdf/FicheTechnique'

export function ExportPDFButton({ fiche }: { fiche: FicheTechniqueData }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'fiche-technique', data: fiche }),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fiche-${fiche.nom.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[ExportPDF]', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="block w-full text-center py-3 border border-accent/40 rounded-xl text-accent hover:bg-accent/5 text-sm font-medium disabled:opacity-50 mt-2"
    >
      {loading ? 'Génération PDF...' : '↓ Exporter en PDF'}
    </button>
  )
}
