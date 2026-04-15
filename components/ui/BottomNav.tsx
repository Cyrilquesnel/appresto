'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PMSNavLink } from '@/components/PMSNavLink'

export function BottomNav() {
  const pathname = usePathname()

  const linkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return `flex flex-col items-center text-xs transition-colors ${
      isActive ? 'text-accent' : 'text-gray-500'
    }`
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {/* Dashboard */}
        <Link href="/dashboard" className={linkClass('/dashboard')}>
          <span className="text-xl">📊</span>
          <span>Tableau</span>
        </Link>

        {/* Plats */}
        <Link href="/plats" className={linkClass('/plats')}>
          <span className="text-xl">🍽</span>
          <span>Plats</span>
        </Link>

        {/* Centre — espace pour le FAB */}
        <div className="w-14" aria-hidden="true" />

        {/* Achats */}
        <Link href="/mercuriale" className={linkClass('/mercuriale')}>
          <span className="text-xl">🛒</span>
          <span>Achats</span>
        </Link>

        {/* PMS — avec badge alertes */}
        <PMSNavLink />

        {/* Paramètres */}
        <Link href="/settings" className={linkClass('/settings')}>
          <span className="text-xl">⚙️</span>
          <span>Réglages</span>
        </Link>
      </div>
    </nav>
  )
}
