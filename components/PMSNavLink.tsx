'use client'
import { usePathname } from 'next/navigation'
import { Thermometer } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

export function PMSNavLink({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const pathname = usePathname()
  const isActive = pathname === '/pms' || pathname.startsWith('/pms/')

  const { data: alerts } = trpc.pms.getRappelAlerts.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh toutes les 5 min
  })
  const count = alerts?.filter((a) => !a.traite).length ?? 0

  const className = `flex flex-col items-center gap-0.5 text-xs transition-colors relative ${
    isActive ? 'text-accent' : 'text-gray-400'
  }`

  if (onNavigate) {
    return (
      <button type="button" onClick={() => onNavigate('/pms')} className={className}>
        <Thermometer size={22} strokeWidth={1.75} />
        <span>PMS</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    )
  }

  return (
    <a href="/pms" className={className}>
      <Thermometer size={22} strokeWidth={1.75} />
      <span>PMS</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </a>
  )
}
