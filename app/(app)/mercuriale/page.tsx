'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MercurialeTable } from '@/components/mercuriale/MercurialeTable'
import { InvoiceUpload, type InvoiceResult } from '@/components/mercuriale/InvoiceUpload'
import { InvoiceReviewModal } from '@/components/mercuriale/InvoiceReviewModal'
import { trpc } from '@/lib/trpc/client'

export default function MercurialePage() {
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [showAiReview, setShowAiReview] = useState(false)
  const utils = trpc.useUtils()

  function handleInvoiceResult(result: InvoiceResult) {
    setInvoiceResult(result)
    if (result.auto_updated.length > 0) {
      utils.commandes.getAllIngredientsMercuriale.invalidate()
    }
    // Ouvrir la modal de révision si des suggestions IA sont disponibles
    if ((result.ai_suggested?.length ?? 0) > 0) {
      setShowAiReview(true)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Mercuriale</h1>
        <Link
          href="/mercuriale/fournisseurs"
          className="text-sm text-accent font-medium hover:underline"
        >
          Gérer les fournisseurs →
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Prix actifs par ingrédient. Une modification déclenche le recalcul automatique des coûts de
        revient.
      </p>

      <div className="mb-4">
        <InvoiceUpload onResult={handleInvoiceResult} />
      </div>

      {invoiceResult && (
        <div
          className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-2"
          data-testid="invoice-result"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Résultat OCR</h3>
            <button
              onClick={() => setInvoiceResult(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {invoiceResult.auto_updated.length > 0 && (
            <p className="text-xs text-green-600">
              {invoiceResult.auto_updated.length} prix mis à jour automatiquement
            </p>
          )}
          {invoiceResult.requires_manual > 0 && (
            <p className="text-xs text-orange-500">
              {invoiceResult.requires_manual} produit(s) non reconnu(s) — vérification manuelle
              requise
            </p>
          )}

          <div className="divide-y divide-gray-100">
            {invoiceResult.invoice.lignes.map((ligne, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${ligne.matched ? 'text-gray-900' : 'text-orange-500'}`}
                  >
                    {ligne.designation}
                    {!ligne.matched && ' ·'}
                  </p>
                  {(ligne.dlc || ligne.numero_lot) && (
                    <p className="text-xs text-gray-400">
                      {ligne.dlc && `DLC: ${ligne.dlc}`}
                      {ligne.dlc && ligne.numero_lot && ' · '}
                      {ligne.numero_lot && `Lot: ${ligne.numero_lot}`}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono text-gray-700 flex-shrink-0">
                  {ligne.prix_unitaire_ht.toFixed(2)} €/{ligne.unite}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MercurialeTable />

      {showAiReview && invoiceResult && (invoiceResult.ai_suggested?.length ?? 0) > 0 && (
        <InvoiceReviewModal
          fournisseurId={null}
          aiSuggested={invoiceResult.ai_suggested!}
          onConfirmed={(count) => {
            if (count > 0) utils.commandes.getAllIngredientsMercuriale.invalidate()
          }}
          onClose={() => setShowAiReview(false)}
        />
      )}
    </div>
  )
}
