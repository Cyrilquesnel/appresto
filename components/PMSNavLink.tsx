'use client'
import { trpc } from '@/lib/trpc/client'

export function PMSNavLink() {
  const { data: alerts } = trpc.pms.getRappelAlerts.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh toutes les 5 min
  })
  const count = alerts?.filter((a) => !a.traite).length ?? 0

  return (
    <a href="/pms" className="flex flex-col items-center text-xs text-gray-600 relative">
      <span className="text-xl">🌡</span>
      <span>PMS</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </a>
  )
}
