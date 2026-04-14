'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

interface FournisseurFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function FournisseurForm({ onSuccess, onCancel }: FournisseurFormProps) {
  const [nom, setNom] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [delai, setDelai] = useState('2')

  const create = trpc.commandes.createFournisseur.useMutation({ onSuccess })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate({
      nom,
      contact_whatsapp: whatsapp || undefined,
      contact_email: email || undefined,
      delai_jours: parseInt(delai, 10),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-4 space-y-3"
      data-testid="fournisseur-form"
    >
      <h3 className="font-semibold text-gray-900">Nouveau fournisseur</h3>

      <input
        type="text"
        placeholder="Nom du fournisseur *"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none"
        data-testid="fournisseur-nom-input"
      />
      <input
        type="tel"
        placeholder="WhatsApp (+33612345678)"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none"
        data-testid="fournisseur-whatsapp-input"
      />
      <input
        type="email"
        placeholder="Email (optionnel)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-accent focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Délai livraison :</label>
        <input
          type="number"
          value={delai}
          onChange={(e) => setDelai(e.target.value)}
          min="0"
          max="30"
          className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-center"
        />
        <span className="text-sm text-gray-500">jours</span>
      </div>

      {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!nom || create.isPending}
          className="flex-1 py-2 bg-accent text-white rounded-xl font-medium disabled:opacity-50"
        >
          {create.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
