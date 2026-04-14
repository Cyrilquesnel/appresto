'use client'
import { trpc } from '@/lib/trpc/client'

interface FournisseurSelectProps {
  value: string | undefined
  onChange: (id: string | undefined) => void
}

export function FournisseurSelect({ value, onChange }: FournisseurSelectProps) {
  const { data: fournisseurs } = trpc.commandes.listFournisseurs.useQuery()

  if (!fournisseurs || fournisseurs.length === 0) return null

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-white"
    >
      <option value="">— Fournisseur (optionnel)</option>
      {fournisseurs.map((f) => (
        <option key={f.id} value={f.id}>
          {f.nom}
        </option>
      ))}
    </select>
  )
}
