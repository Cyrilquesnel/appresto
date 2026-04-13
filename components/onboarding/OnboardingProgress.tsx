'use client'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

export function OnboardingProgress() {
  const { data } = trpc.dashboard.getOnboardingStatus.useQuery()

  if (!data || data.completed) return null

  const steps = [
    { key: 'type_etablissement', label: "Type d'établissement", done: data.steps.type_etablissement, href: '/onboarding' },
    { key: 'premier_plat', label: 'Premier plat', done: data.steps.premier_plat, href: '/plats/nouveau' },
    { key: 'premiers_prix', label: 'Prix en mercuriale', done: data.steps.premiers_prix, href: '/mercuriale' },
    { key: 'premiere_commande', label: 'Première commande', done: data.steps.premiere_commande, href: '/commandes/nouveau' },
  ]

  const completedCount = steps.filter(s => s.done).length

  return (
    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-200 mb-4" data-testid="onboarding-progress">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-indigo-900">Démarrage ({completedCount}/{steps.length})</h3>
        <span className="text-xs text-gray-400">{Math.round(completedCount / steps.length * 100)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all"
          style={{ width: `${completedCount / steps.length * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {steps.map(step => (
          <div key={step.key} className="flex items-center gap-2">
            <span className={step.done ? 'text-green-500' : 'text-gray-300'}>
              {step.done ? '✓' : '○'}
            </span>
            {step.done ? (
              <span className="text-sm text-gray-400 line-through">{step.label}</span>
            ) : (
              <Link href={step.href} className="text-sm text-indigo-600 hover:underline">
                {step.label} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
