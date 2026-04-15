'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function OnboardingPlatPage() {
  const router = useRouter()

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-primary to-accent flex flex-col justify-center px-6 py-12"
      data-testid="onboarding-step-2"
    >
      <div className="text-white mb-8">
        <h1 className="text-2xl font-bold mb-2">Ajoutez votre premier plat</h1>
        <p className="opacity-80">
          Photographiez un plat — l&apos;IA analyse automatiquement les ingrédients
        </p>
        <div className="flex gap-1 mt-4">
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white rounded-full" />
          <div className="h-1 flex-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-4">
        <Link
          href="/plats/nouveau?from=onboarding"
          className="w-full py-6 bg-accent text-white font-semibold rounded-2xl flex items-center justify-center gap-3 text-lg"
          data-testid="take-photo-cta"
        >
          <span className="text-3xl">📸</span>
          <span>Photographier un plat</span>
        </Link>

        <button
          onClick={() => router.push('/onboarding/done')}
          className="w-full py-3 text-gray-400 text-sm hover:text-gray-600"
          data-testid="skip-photo"
        >
          Passer cette étape pour l&apos;instant
        </button>
      </div>
    </div>
  )
}
