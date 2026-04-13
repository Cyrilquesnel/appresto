'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'
import { FournisseurForm } from '@/components/mercuriale/FournisseurForm'

export default function FournisseursPage() {
  const [showForm, setShowForm] = useState(false)
  const { data: fournisseurs, refetch } = trpc.commandes.listFournisseurs.useQuery()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Fournisseurs</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-xl font-medium"
          data-testid="add-fournisseur-button"
        >
          + Ajouter
        </button>
      </div>

      {showForm && (
        <FournisseurForm
          onSuccess={() => {
            setShowForm(false)
            refetch()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {fournisseurs?.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            data-testid={`fournisseur-${f.nom}`}
          >
            <h3 className="font-semibold text-gray-900">{f.nom}</h3>
            {f.contact_whatsapp && (
              <p className="text-sm text-success mt-1">
                WhatsApp : {f.contact_whatsapp}
              </p>
            )}
            {f.contact_email && (
              <p className="text-sm text-gray-500">{f.contact_email}</p>
            )}
            {f.contact_tel && (
              <p className="text-sm text-gray-500">Tél : {f.contact_tel}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Délai : {f.delai_jours}j
              {f.min_commande ? ` · Min. ${f.min_commande}€` : ''}
            </p>
          </div>
        ))}

        {fournisseurs?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucun fournisseur</p>
            <p className="text-sm mt-1">
              Ajoutez vos fournisseurs pour générer des bons de commande
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
