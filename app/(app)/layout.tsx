import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineBadge } from '@/components/pms/OfflineBadge'
import { SWRegistrar } from '@/components/SWRegistrar'
import { RestaurantInitializer } from '@/components/RestaurantInitializer'
import { PushPrompt } from '@/components/PushPrompt'
import { BottomNav } from '@/components/ui/BottomNav'
import { CameraFAB } from '@/components/ui/CameraFAB'

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
      <main className="pb-20">{children}</main>
      <OfflineBadge />
      <PushPrompt />
      <BottomNav />
      <CameraFAB />
    </div>
  )
}
