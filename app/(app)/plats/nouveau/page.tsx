'use client'
import { useState } from 'react'
import { DishCamera } from '@/components/dishes/DishCamera'
import {
  IngredientValidator,
  type ValidatedIngredient,
} from '@/components/dishes/IngredientValidator'
import { FicheTechniqueForm } from '@/components/dishes/FicheTechniqueForm'
import { useRestaurantStore } from '@/lib/store'
import type { DetectedIngredient } from '@/lib/ai/gemini'

type Step = 'capture' | 'validate' | 'fiche'

interface AnalysisResult {
  type_plat: string
  ingredients: DetectedIngredient[]
  confiance_globale: number
  remarques?: string
  image_url: string
}

function toValidated(detected: DetectedIngredient[]): ValidatedIngredient[] {
  return detected.map((d) => ({
    nom: d.nom,
    grammage: d.grammage_suggere ?? 100,
    unite: 'g',
    allergenes: d.allergenes ?? [],
    confiance: d.confiance,
  }))
}

export default function NouveauPlatPage() {
  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [validatedIngredients, setValidatedIngredients] = useState<ValidatedIngredient[]>([])
  const [error, setError] = useState<string | null>(null)
  const restaurantId = useRestaurantStore((s) => s.restaurantId)

  const handleCapture = async (file: File) => {
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/analyze-dish', {
        method: 'POST',
        headers: { 'x-restaurant-id': restaurantId ?? '' },
        body: formData,
      })

      if (res.status === 429) {
        setError('Limite atteinte : 20 analyses par jour. Réessayez demain.')
        return
      }
      if (!res.ok) throw new Error('Erreur analyse')

      const data = (await res.json()) as AnalysisResult
      setResult(data)
      setValidatedIngredients(toValidated(data.ingredients))
      setStep('validate')
    } catch {
      setError("Impossible d'analyser la photo. Vérifiez votre connexion.")
    } finally {
      setLoading(false)
    }
  }

  // Étape 3 : formulaire fiche technique
  if (step === 'fiche' && result) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setStep('validate')} className="text-gray-500 hover:text-gray-700">
            ←
          </button>
          <h1 className="text-xl font-bold">Créer la fiche technique</h1>
        </div>
        <FicheTechniqueForm
          initialIngredients={validatedIngredients}
          photoUrl={preview ?? undefined}
          typePlat={result.type_plat}
        />
      </div>
    )
  }

  // Étape 2 : validation ingrédients
  if (step === 'validate' && result) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setStep('capture')} className="text-gray-500 hover:text-gray-700">
            ←
          </button>
          <h1 className="text-xl font-bold">Valider les ingrédients</h1>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && (
          <img
            src={preview}
            alt="Plat analysé"
            className="w-full rounded-xl object-cover mb-4"
            style={{ maxHeight: '200px' }}
          />
        )}

        <p className="text-sm text-gray-500 mb-3">
          {result.type_plat} — {validatedIngredients.length} ingrédient(s) détecté(s)
        </p>

        <IngredientValidator
          initialIngredients={validatedIngredients}
          onChange={setValidatedIngredients}
        />

        <button
          onClick={() => setStep('fiche')}
          disabled={validatedIngredients.length === 0}
          className="mt-6 w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
          data-testid="create-fiche-btn"
        >
          Créer la fiche technique →
        </button>
      </div>
    )
  }

  // Étape 1 : capture photo
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Nouveau plat</h1>

      <DishCamera onCapture={handleCapture} preview={preview} />

      {loading && (
        <div className="mt-4 text-center" data-testid="ai-loading">
          <p className="text-gray-600">Analyse en cours...</p>
        </div>
      )}

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
    </div>
  )
}
