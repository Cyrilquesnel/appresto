'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MercurialeTable } from '@/components/mercuriale/MercurialeTable'
import { InvoiceUpload, type InvoiceResult } from '@/components/mercuriale/InvoiceUpload'
import { InvoiceReviewModal } from '@/components/mercuriale/InvoiceReviewModal'
import { InvoiceManualReviewModal } from '@/components/mercuriale/InvoiceManualReviewModal'
import { trpc } from '@/lib/trpc/client'

const ACHATS_TABS = [
  { label: 'Mercuriale', href: '/mercuriale' },
  { label: 'Commandes', href: '/commandes' },
  { label: 'Inventaire', href: '/inventaire' },
  { label: 'Fournisseurs', href: '/mercuriale/fournisseurs' },
]

export default function MercurialePage() {
  const pathname = usePathname()
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [showAiReview, setShowAiReview] = useState(false)
  const [showManualReview, setShowManualReview] = useState(false)
  const utils = trpc.useUtils()

  function handleInvoiceResult(result: InvoiceResult) {
    setInvoiceResult(result)
    if (result.auto_updated.length > 0) {
      utils.commandes.getAllIngredientsMercuriale.invalidate()
    }
    if ((result.ai_suggested?.length ?? 0) > 0) {
      setShowAiReview(true)
    }
    // Ouvrir la modal manuelle si des lignes non reconnues
    if (result.requires_manual > 0) {
      setShowManualReview(true)
    }
  }

  const unmatchedLignes = invoiceResult?.invoice.lignes.filter((l) => !l.matched) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hub Achats — navigation entre les 3 sections */}
      <div className="flex gap-2 mb-6">
        {ACHATS_TABS.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl text-center transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <h1 className="text-xl font-bold text-primary mb-6">Mercuriale</h1>

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

      {showManualReview && unmatchedLignes.length > 0 && (
        <InvoiceManualReviewModal
          lignes={unmatchedLignes}
          onSaved={() => utils.commandes.getAllIngredientsMercuriale.invalidate()}
          onClose={() => setShowManualReview(false)}
        />
      )}
    </div>
  )
}
