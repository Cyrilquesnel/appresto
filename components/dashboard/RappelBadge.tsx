'use client'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'

export function RappelBadge() {
  const { data: alerts } = trpc.pms.getRappelAlerts.useQuery()
  const count = alerts?.filter((a) => !a.traite).length ?? 0

  if (count === 0) return null

  return (
    <Link
      href="/pms/rappels"
      className="flex items-center gap-3 bg-red-50 rounded-2xl p-4 border border-red-200"
    >
      <span className="text-2xl">⚠️</span>
      <div className="flex-1">
        <p className="font-semibold text-red-700 text-sm">
          {count} rappel{count > 1 ? 's' : ''} produit{count > 1 ? 's' : ''} actif
          {count > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-red-500">Cliquer pour voir les alertes RappelConso</p>
      </div>
    </Link>
  )
}
