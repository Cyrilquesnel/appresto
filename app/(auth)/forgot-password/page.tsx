'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    // Toujours afficher le message de succès (sécurité : ne pas révéler si l'email existe)
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-gray-700">
          Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de
          réinitialisation dans les prochaines minutes.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          ← Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2"
          placeholder="chef@restaurant.fr"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? 'Envoi...' : 'Envoyer le lien'}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-gray-500 hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </form>
  )
}
