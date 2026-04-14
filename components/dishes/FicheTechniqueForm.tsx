'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { IngredientValidator, type ValidatedIngredient } from './IngredientValidator'
import { AllergenesDisplay } from './AllergenesDisplay'

interface FicheTechniqueFormProps {
  initialIngredients?: ValidatedIngredient[]
  photoUrl?: string
  typePlat?: string
}

export function FicheTechniqueForm({
  initialIngredients = [],
  photoUrl,
  typePlat,
}: FicheTechniqueFormProps) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)

  const allergenesCalcules = Array.from(new Set(ingredients.flatMap((ing) => ing.allergenes)))

  const createFiche = trpc.fiches.create.useMutation({
    onSuccess: ({ plat_id }) => router.push(`/plats/${plat_id}`),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createFiche.mutate({
      plat: {
        nom,
        photo_url: photoUrl,
        type_plat: typePlat,
        prix_vente_ht: prixVente ? parseFloat(prixVente) : undefined,
        statut: 'brouillon',
      },
      ingredients: ingredients.map((ing) => ({
        ingredient_id: ing.id,
        nom: ing.nom,
        grammage: ing.grammage,
        unite: ing.unite,
        allergenes: ing.allergenes,
        is_manual: ing.isManual ?? false,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="fiche-technique-form">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Photo du plat" className="w-full h-48 object-cover rounded-2xl" />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          placeholder="ex: Magret de canard sauce orange"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2"
          data-testid="plat-nom-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prix de vente HT (€) — optionnel
        </label>
        <input
          type="number"
          value={prixVente}
          onChange={(e) => setPrixVente(e.target.value)}
          min={0}
          step={0.01}
          placeholder="ex: 18.50"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2"
          data-testid="plat-prix-input"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Ingrédients</h3>
        <IngredientValidator initialIngredients={ingredients} onChange={setIngredients} />
      </div>

      {allergenesCalcules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Allergènes détectés</h3>
          <AllergenesDisplay allergenes={allergenesCalcules} />
        </div>
      )}

      <button
        type="submit"
        disabled={!nom || ingredients.length === 0 || createFiche.isPending}
        className="w-full py-4 bg-green-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-fiche-button"
      >
        {createFiche.isPending ? 'Enregistrement...' : 'Sauvegarder la fiche'}
      </button>

      {createFiche.isError && (
        <p className="text-red-600 text-sm text-center">Erreur: {createFiche.error.message}</p>
      )}
    </form>
  )
}
