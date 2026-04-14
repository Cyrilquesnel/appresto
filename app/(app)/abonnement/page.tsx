'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { PLANS, type Plan } from '@/lib/stripe'
import Link from 'next/link'

export default function AbonnementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutSuccess = searchParams.get('checkout') === 'success'

  const [loading, setLoading] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: sub } = trpc.stripe.getSubscription.useQuery()
  const { data: restaurant } = trpc.dashboard.getMyRestaurant.useQuery()
  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: ({ url }) => router.push(url),
  })

  async function handleCheckout(plan: Plan) {
    setLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurant?.id ?? '',
        },
        body: JSON.stringify({ plan }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Erreur Stripe')
      router.push(data.url)
    } catch (e) {
      setError((e as Error).message)
      setLoading(null)
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-xl font-bold">Abonnement</h1>
      </div>

      {checkoutSuccess && (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-green-700 font-semibold">Abonnement activé — bienvenue !</p>
        </div>
      )}

      {/* Abonnement actif */}
      {sub && (
        <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Plan actuel</p>
              <p className="text-lg font-bold text-indigo-700 capitalize">{sub.plan}</p>
              <p className="text-xs text-gray-500 mt-1 capitalize">
                Statut : {sub.statut === 'trialing' ? "Période d'essai" : sub.statut}
              </p>
              {sub.trial_end && sub.statut === 'trialing' && (
                <p className="text-xs text-gray-400">
                  {"Essai jusqu'au"} {new Date(sub.trial_end).toLocaleDateString('fr-FR')}
                </p>
              )}
              {sub.current_period_end && sub.statut !== 'trialing' && (
                <p className="text-xs text-gray-400">
                  Renouvellement le {new Date(sub.current_period_end).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => createPortal.mutate({ returnUrl: `${appUrl}/abonnement` })}
              disabled={createPortal.isPending}
              className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              Gérer →
            </button>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="space-y-3">
        {(Object.entries(PLANS) as [Plan, (typeof PLANS)[Plan]][]).map(([key, plan]) => {
          const isCurrentPlan = sub?.plan === key
          return (
            <div
              key={key}
              className={`rounded-2xl p-4 border ${
                isCurrentPlan ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-900">
                    {plan.nom}
                    {isCurrentPlan && (
                      <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        Actuel
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {plan.prix} €<span className="text-xs font-normal text-gray-400">/mois</span>
                </p>
              </div>
              <ul className="space-y-1 mb-3">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              {!isCurrentPlan && (
                <button
                  type="button"
                  onClick={() => handleCheckout(key)}
                  disabled={loading !== null}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                >
                  {loading === key ? 'Chargement...' : `Choisir ${plan.nom}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        14 jours d'essai gratuit · Sans engagement · Paiement sécurisé par Stripe
      </p>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
