'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'

const TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'brasserie', label: 'Brasserie' },
  { value: 'gastronomique', label: 'Gastronomique' },
  { value: 'snack', label: 'Snack / Fast-casual' },
  { value: 'traiteur', label: 'Traiteur' },
  { value: 'autre', label: 'Autre' },
] as const

type TypeEtablissement = (typeof TYPES)[number]['value']

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const { data: restaurant } = trpc.dashboard.getMyRestaurant.useQuery()
  const updateRestaurant = trpc.dashboard.updateRestaurant.useMutation()

  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeEtablissement | ''>('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setNom(restaurant.nom ?? '')
      setType((restaurant.type_etablissement as TypeEtablissement | null) ?? '')
    }
  }, [restaurant])

  const handleSave = async () => {
    await updateRestaurant.mutateAsync({
      nom: nom || undefined,
      type_etablissement: (type as TypeEtablissement) || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Paramètres</h1>

      {/* Profil restaurant */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Profil du restaurant</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Nom du restaurant</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Le Bistrot du Chef"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Type d&apos;établissement</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeEtablissement | '')}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">Sélectionner…</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={updateRestaurant.isPending}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {updateRestaurant.isPending ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </button>
      </div>

      {/* Déconnexion */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-medium text-sm"
      >
        Se déconnecter
      </button>
    </div>
  )
}
