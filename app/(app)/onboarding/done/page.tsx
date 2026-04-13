'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OnboardingDonePage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push('/dashboard'), 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-green-600 to-green-500 flex flex-col items-center justify-center px-6"
      data-testid="onboarding-done"
    >
      <div className="text-center text-white">
        <div className="text-8xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-3">C&apos;est parti !</h1>
        <p className="text-lg opacity-80 mb-8">Votre restaurant est configuré</p>
        <p className="text-sm opacity-60">Redirection vers le tableau de bord...</p>
      </div>
    </div>
  )
}
