'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurantNom, setRestaurantNom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Vérification limite beta (20 places)
    const { data: betaOpen, error: betaError } = await supabase.rpc('is_beta_open')
    if (betaError || !betaOpen) {
      setError(
        "Les inscriptions beta sont fermées — 20/20 places occupées. Rejoignez la liste d'attente sur onrush.app"
      )
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert({ nom: restaurantNom, owner_id: data.user.id, parametres: {} })
        .select('id')
        .single()

      if (restError || !restaurant) {
        setError('Erreur lors de la création du restaurant')
        setLoading(false)
        return
      }

      await supabase.from('restaurant_users').insert({
        restaurant_id: restaurant.id,
        user_id: data.user.id,
        role: 'owner',
      })

      router.push('/onboarding')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom de votre restaurant
        </label>
        <input
          type="text"
          value={restaurantNom}
          onChange={(e) => setRestaurantNom(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Le Bistrot du Coin"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="chef@restaurant.fr"
          name="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
          placeholder="Minimum 8 caractères"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? 'Création...' : 'Créer mon compte'}
      </button>
      <p className="text-center text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--color-accent)' }}>
          Se connecter
        </Link>
      </p>
    </form>
  )
}
