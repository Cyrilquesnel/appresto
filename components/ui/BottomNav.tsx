'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, UtensilsCrossed, ShoppingCart, Settings } from 'lucide-react'
import { PMSNavLink } from '@/components/PMSNavLink'

export function BottomNav() {
  const pathname = usePathname()

  const linkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return `flex flex-col items-center gap-0.5 text-xs transition-colors ${
      isActive ? 'text-accent' : 'text-gray-400'
    }`
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-evenly h-14">
        {/* Dashboard */}
        <Link href="/dashboard" className={linkClass('/dashboard')}>
          <BarChart3 size={22} strokeWidth={1.75} />
          <span>Tableau</span>
        </Link>

        {/* Plats */}
        <Link href="/plats" className={linkClass('/plats')}>
          <UtensilsCrossed size={22} strokeWidth={1.75} />
          <span>Plats</span>
        </Link>

        {/* Centre — espace pour le FAB */}
        <div className="w-14" aria-hidden="true" />

        {/* Achats */}
        <Link href="/mercuriale" className={linkClass('/mercuriale')}>
          <ShoppingCart size={22} strokeWidth={1.75} />
          <span>Achats</span>
        </Link>

        {/* PMS — avec badge alertes */}
        <PMSNavLink />

        {/* Paramètres */}
        <Link href="/settings" className={linkClass('/settings')}>
          <Settings size={22} strokeWidth={1.75} />
          <span>Réglages</span>
        </Link>
      </div>
    </nav>
  )
}
