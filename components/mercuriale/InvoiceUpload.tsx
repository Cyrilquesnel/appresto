'use client'
import { useState, useRef } from 'react'
import { useRestaurantStore } from '@/stores/restaurant'

export interface InvoiceLigne {
  designation: string
  dlc?: string
  numero_lot?: string
  quantite: number
  unite: string
  prix_unitaire_ht: number
  ingredient_id: string | null
  matched: boolean
  match_source?: 'mapping' | 'fuzzy' | 'ai' | 'none'
  ai_confidence?: number
}

export interface InvoiceResult {
  invoice: {
    fournisseur_nom?: string
    date_facture?: string
    numero_facture?: string
    lignes: InvoiceLigne[]
  }
  auto_updated: string[]
  requires_manual: number
  ai_suggested?: InvoiceLigne[]
}

interface InvoiceUploadProps {
  onResult: (result: InvoiceResult) => void
}

export function InvoiceUpload({ onResult }: InvoiceUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const restaurantId = useRestaurantStore((s) => s.restaurantId)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/process-invoice', {
        method: 'POST',
        headers: { 'x-restaurant-id': restaurantId ?? '' },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
      onResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        data-testid="invoice-upload-input"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-600 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        data-testid="invoice-upload-button"
      >
        {loading ? 'Analyse en cours...' : 'Scanner une facture'}
      </button>
      {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
    </div>
  )
}
