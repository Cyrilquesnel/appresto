'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { SaisieVentesSimple } from '@/components/dashboard/SaisieVentesSimple'
import { SaisieVentesDetail } from '@/components/dashboard/SaisieVentesDetail'

export default function SaisieVentesPage() {
  const { data: mode } = trpc.dashboard.getModeVentes.useQuery()
  const [success, setSuccess] = useState<number | null>(null)

  if (success !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Ventes enregistrées !</h2>
        <p className="text-3xl font-bold text-green-600 mb-6">{success.toFixed(2)} € HT</p>
        <button
          onClick={() => setSuccess(null)}
          className="text-indigo-600 hover:underline"
        >
          Saisir un autre service
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Saisie des ventes</h1>
      {mode === 'detail' ? (
        <SaisieVentesDetail onSuccess={setSuccess} />
      ) : (
        <SaisieVentesSimple onSuccess={setSuccess} />
      )}
    </div>
  )
}
