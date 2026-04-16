'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRestaurantStore } from '@/stores/restaurant'
import type { BonDeCommandeData } from '@/lib/whatsapp'

interface SendBonOptionsProps {
  bon: BonDeCommandeData & { id: string }
  onSent: () => void
}

export function SendBonOptions({ bon, onSent }: SendBonOptionsProps) {
  const [loading, setLoading] = useState<'whatsapp' | 'email' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const restaurantId = useRestaurantStore((s) => s.restaurantId)
  const updateStatut = trpc.commandes.updateStatutBon.useMutation()

  async function sendWhatsApp() {
    setLoading('whatsapp')
    setError(null)
    try {
      const res = await fetch('/api/send-bon/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurantId ?? '',
        },
        body: JSON.stringify({ bon_id: bon.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur envoi WhatsApp')
      await updateStatut.mutateAsync({ bonId: bon.id, statut: 'envoye', envoye_via: 'whatsapp' })
      onSent()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function sendEmail() {
    setLoading('email')
    setError(null)
    try {
      const res = await fetch('/api/send-bon/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurantId ?? '',
        },
        body: JSON.stringify({ bon_id: bon.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur envoi email')
      await updateStatut.mutateAsync({ bonId: bon.id, statut: 'envoye', envoye_via: 'email' })
      onSent()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function downloadPDF() {
    setLoading('pdf')
    setError(null)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bon-de-commande', data: bon }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur génération PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bon-commande-${bon.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await updateStatut.mutateAsync({ bonId: bon.id, statut: 'envoye', envoye_via: 'pdf' })
      onSent()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3" data-testid="send-bon-options">
      {/* WhatsApp — PRIORITÉ 1 (D10 DISCOVERY) */}
      {bon.fournisseur.contact_whatsapp && (
        <button
          onClick={sendWhatsApp}
          disabled={!!loading}
          className="w-full py-4 bg-[#25D366] text-white font-semibold rounded-2xl disabled:opacity-50"
          data-testid="send-whatsapp-button"
        >
          {loading === 'whatsapp' ? 'Envoi...' : 'Envoyer via WhatsApp'}
        </button>
      )}

      {/* Email — PRIORITÉ 2 */}
      {bon.fournisseur.contact_email && (
        <button
          onClick={sendEmail}
          disabled={!!loading}
          className="w-full py-4 bg-blue-600 text-white font-semibold rounded-2xl disabled:opacity-50"
          data-testid="send-email-button"
        >
          {loading === 'email' ? 'Envoi...' : 'Envoyer par email'}
        </button>
      )}

      {/* PDF — PRIORITÉ 3 */}
      <button
        onClick={downloadPDF}
        disabled={!!loading}
        className="w-full py-4 bg-gray-700 text-white font-semibold rounded-2xl disabled:opacity-50"
        data-testid="download-pdf-button"
      >
        {loading === 'pdf' ? 'Génération...' : 'Télécharger PDF'}
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
