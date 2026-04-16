'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { FicheTechniqueForm } from '@/components/dishes/FicheTechniqueForm'

export default function ModifierPlatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [isDirty, setIsDirty] = useState(false)
  // Empêche React Query de refetcher en arrière-plan et de déclencher un remount du formulaire
  const { data: plat, isLoading } = trpc.fiches.get.useQuery(
    { platId: id },
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 }
  )
  const update = trpc.fiches.update.useMutation({
    onSuccess: () => {
      setIsDirty(false)
      router.push(`/plats/${id}`)
    },
  })

  // Avertissement si l'utilisateur quitte avec des modifications non sauvegardées
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  if (!plat) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Plat introuvable</p>
      </div>
    )
  }

  const initialIngredients = plat.fiche_technique
    ? [...plat.fiche_technique]
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({
          id: l.ingredient_id ?? undefined,
          nom: l.nom_ingredient ?? '',
          grammage: l.grammage,
          unite: l.unite,
          allergenes: [] as string[],
          confiance: 1,
        }))
    : []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ←
        </button>
        <h1 className="text-xl font-bold">Modifier — {plat.nom}</h1>
      </div>

      {update.isError && (
        <p className="mb-4 text-red-600 text-sm text-center bg-red-50 rounded-xl p-3">
          Erreur : {update.error.message}
        </p>
      )}

      {/* key={plat.id} garantit un remount propre si l'ID change — jamais de state résiduel */}
      <FicheTechniqueForm
        key={plat.id}
        initialNom={plat.nom}
        initialStatut={(plat.statut as 'brouillon' | 'actif') ?? 'brouillon'}
        initialPrix={plat.prix_vente_ht ?? undefined}
        initialIngredients={initialIngredients}
        onDirtyChange={setIsDirty}
        onSubmit={async (data) => {
          await update.mutateAsync({
            platId: id,
            plat: {
              nom: data.nom,
              statut: data.statut,
              prix_vente_ht: data.prix_vente_ht,
            },
            ingredients: data.ingredients.map((ing) => ({
              ingredient_id: ing.id,
              nom: ing.nom,
              grammage: ing.grammage,
              unite: ing.unite,
              allergenes: ing.allergenes,
              is_manual: ing.isManual ?? false,
            })),
          })
        }}
        isSubmitting={update.isPending}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  )
}
