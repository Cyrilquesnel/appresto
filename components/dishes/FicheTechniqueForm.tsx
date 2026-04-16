'use client'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { IngredientValidator, type ValidatedIngredient } from './IngredientValidator'
import { AllergenesDisplay } from './AllergenesDisplay'
import { IngredientLinkModal } from './IngredientLinkModal'
import type { IngredientLinkSuggestion } from '@/server/routers/fiches'

interface SubmitData {
  nom: string
  statut: 'brouillon' | 'actif'
  prix_vente_ht?: number
  ingredients: ValidatedIngredient[]
}

interface FicheTechniqueFormProps {
  initialIngredients?: ValidatedIngredient[]
  photoUrl?: string
  typePlat?: string
  // Edit mode props
  initialNom?: string
  initialStatut?: 'brouillon' | 'actif'
  initialPrix?: number
  onSubmit?: (data: SubmitData) => Promise<void>
  onDirtyChange?: (isDirty: boolean) => void
  isSubmitting?: boolean
  submitLabel?: string
}

export function FicheTechniqueForm({
  initialIngredients = [],
  photoUrl,
  typePlat,
  initialNom = '',
  initialStatut = 'brouillon',
  initialPrix,
  onSubmit,
  onDirtyChange,
  isSubmitting,
  submitLabel,
}: FicheTechniqueFormProps) {
  const router = useRouter()
  const [nom, setNom] = useState(initialNom)
  const [statut, setStatut] = useState<'brouillon' | 'actif'>(initialStatut)
  const [prixVente, setPrixVente] = useState(initialPrix != null ? String(initialPrix) : '')
  const [ingredients, setIngredients] = useState<ValidatedIngredient[]>(initialIngredients)
  const [dirty, setDirty] = useState(false)

  // Notifie le parent dès qu'une modification est faite
  const markDirty = () => {
    if (!dirty) {
      setDirty(true)
      onDirtyChange?.(true)
    }
  }

  useEffect(() => {
    if (dirty) onDirtyChange?.(true)
  }, [dirty, onDirtyChange])
  const [linkModal, setLinkModal] = useState<{
    platId: string
    suggestions: IngredientLinkSuggestion[]
  } | null>(null)

  const allergenesCalcules = Array.from(new Set(ingredients.flatMap((ing) => ing.allergenes)))

  const createFiche = trpc.fiches.create.useMutation({
    onSuccess: ({ plat_id, ai_suggestions }) => {
      if (ai_suggestions && ai_suggestions.length > 0) {
        setLinkModal({ platId: plat_id, suggestions: ai_suggestions })
      } else {
        router.push(`/plats/${plat_id}`)
      }
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      await onSubmit({
        nom,
        statut,
        prix_vente_ht: prixVente ? parseFloat(prixVente) : undefined,
        ingredients,
      })
    } else {
      createFiche.mutate({
        plat: {
          nom,
          photo_url: photoUrl,
          type_plat: typePlat,
          prix_vente_ht: prixVente ? parseFloat(prixVente) : undefined,
          statut,
        },
        ingredients: ingredients.map((ing) => ({
          ingredient_id: ing.id,
          nom: ing.nom,
          grammage: ing.grammage,
          unite: ing.unite,
          allergenes: ing.allergenes,
          is_manual: ing.isManual ?? false,
          fournisseur_id: ing.fournisseur_id,
          prix_achat: ing.prix_achat,
          unite_achat: ing.unite_achat,
        })),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="fiche-technique-form">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            photoUrl.startsWith('http') || photoUrl.startsWith('blob')
              ? photoUrl
              : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dish-photos/${photoUrl}`
          }
          alt="Photo du plat"
          className="w-full h-48 object-cover rounded-2xl"
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
        <input
          type="text"
          value={nom}
          onChange={(e) => {
            setNom(e.target.value)
            markDirty()
          }}
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
          onChange={(e) => {
            setPrixVente(e.target.value)
            markDirty()
          }}
          min={0}
          step={0.01}
          placeholder="ex: 18.50"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2"
          data-testid="plat-prix-input"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Ingrédients</h3>
        <IngredientValidator
          ingredients={ingredients}
          onChange={(v) => {
            setIngredients(v)
            markDirty()
          }}
        />
      </div>

      {allergenesCalcules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Allergènes détectés</h3>
          <AllergenesDisplay allergenes={allergenesCalcules} />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
        <select
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value as 'brouillon' | 'actif')
            markDirty()
          }}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2"
        >
          <option value="brouillon">Brouillon</option>
          <option value="actif">Actif</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={!nom || ingredients.length === 0 || (isSubmitting ?? createFiche.isPending)}
        className="w-full py-4 bg-green-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
        data-testid="save-fiche-button"
      >
        {(isSubmitting ?? createFiche.isPending)
          ? 'Enregistrement...'
          : (submitLabel ?? 'Sauvegarder la fiche')}
      </button>

      {createFiche.isError && (
        <p className="text-red-600 text-sm text-center">Erreur: {createFiche.error.message}</p>
      )}

      {linkModal && (
        <IngredientLinkModal
          platId={linkModal.platId}
          suggestions={linkModal.suggestions}
          onDone={() => router.push(`/plats/${linkModal.platId}`)}
        />
      )}
    </form>
  )
}
