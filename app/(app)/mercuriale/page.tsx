'use client'
import Link from 'next/link'
import { MercurialeTable } from '@/components/mercuriale/MercurialeTable'

export default function MercurialePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Mercuriale</h1>
        <Link
          href="/mercuriale/fournisseurs"
          className="text-sm text-accent font-medium hover:underline"
        >
          Gérer les fournisseurs →
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Prix actifs par ingrédient. Une modification déclenche le recalcul automatique
        des coûts de revient.
      </p>

      <MercurialeTable />
    </div>
  )
}
