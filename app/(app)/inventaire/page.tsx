'use client'
import { trpc } from '@/lib/trpc/client'
import { InventaireForm } from '@/components/inventaire/InventaireForm'

export default function InventairePage() {
  const { data, isLoading, refetch } = trpc.commandes['inventaire.list'].useQuery()

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary">Inventaire du jour</h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">{today}</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" />
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-2xl mb-2">📦</p>
          <p className="font-medium">Aucun ingrédient dans la mercuriale</p>
          <p className="text-sm mt-1 text-gray-400">
            Ajoutez des prix dans la mercuriale pour gérer votre stock.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <InventaireForm ingredients={data} onSaved={() => refetch()} />
      )}
    </div>
  )
}
