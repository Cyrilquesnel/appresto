import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineBadge } from '@/components/pms/OfflineBadge'
import { SWRegistrar } from '@/components/SWRegistrar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <SWRegistrar />
      <main className="pb-20">{children}</main>
      <OfflineBadge />
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14">
          <a href="/dashboard" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">📊</span>
            <span>Tableau</span>
          </a>
          <a href="/plats" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">🍽</span>
            <span>Plats</span>
          </a>
          <a href="/commandes" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">📦</span>
            <span>Commandes</span>
          </a>
          <a href="/pms" className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-xl">🌡</span>
            <span>PMS</span>
          </a>
        </div>
      </nav>
    </div>
  )
}
