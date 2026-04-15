import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineBadge } from '@/components/pms/OfflineBadge'
import { SWRegistrar } from '@/components/SWRegistrar'
import { RestaurantInitializer } from '@/components/RestaurantInitializer'
import { PushPrompt } from '@/components/PushPrompt'
import { BottomNav } from '@/components/ui/BottomNav'
import { CameraFAB } from '@/components/ui/CameraFAB'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantInitializer />
      <SWRegistrar />
      {/* Bouton paramètres — accessible depuis toutes les pages */}
      <Link
        href="/settings"
        aria-label="Paramètres"
        className="fixed top-0 right-0 z-40 flex items-center justify-center w-11 h-11 text-gray-500"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <span className="text-xl">⚙️</span>
      </Link>
      <main className="pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2.75rem)' }}>{children}</main>
      <OfflineBadge />
      <PushPrompt />
      <BottomNav />
      <CameraFAB />
    </div>
  )
}
