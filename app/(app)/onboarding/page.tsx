'use client'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const TYPES_ETABLISSEMENT = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽' },
  { value: 'brasserie', label: 'Brasserie', emoji: '🍺' },
  { value: 'gastronomique', label: 'Gastronomique', emoji: '⭐' },
  { value: 'snack', label: 'Snack / Fastfood', emoji: '🍔' },
  { value: 'traiteur', label: 'Traiteur', emoji: '🥘' },
  { value: 'autre', label: 'Autre', emoji: '🍴' },
] as const

type TypeEtablissement = (typeof TYPES_ETABLISSEMENT)[number]['value']

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<TypeEtablissement | ''>('')
  const complete = trpc.dashboard.completeOnboarding.useMutation({
    onSuccess: () => router.push('/onboarding/plat'),
  })

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-primary to-accent flex flex-col justify-center px-6 py-12"
      data-testid="onboarding-step-1"
    >
      <div className="text-white mb-8">
        <h1 className="text-3xl font-bold mb-2">Bienvenue sur Le Rush</h1>
        <p className="text-lg opacity-80">Configurez votre restaurant en 2 minutes</p>
        <div className="flex gap-1 mt-4">
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Quel type d&apos;établissement ?</h2>
        <div className="grid grid-cols-2 gap-3">
          {TYPES_ETABLISSEMENT.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelected(type.value)}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                selected === type.value
                  ? 'border-accent/80 bg-accent/5'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
              data-testid={`type-${type.value}`}
            >
              <span className="text-3xl">{type.emoji}</span>
              <span className="text-sm font-medium text-gray-700">{type.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && complete.mutate({ type_etablissement: selected })}
          disabled={!selected || complete.isPending}
          className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50 mt-4"
          data-testid="continue-onboarding"
        >
          {complete.isPending ? 'Enregistrement...' : 'Continuer →'}
        </button>
      </div>
    </div>
  )
}
