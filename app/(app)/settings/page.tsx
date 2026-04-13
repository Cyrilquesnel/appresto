'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Paramètres</h1>
      <button
        onClick={handleLogout}
        className="mt-6 w-full py-3 rounded-lg border border-red-300 text-red-600 font-medium"
      >
        Se déconnecter
      </button>
    </div>
  )
}
