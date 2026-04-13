'use client'
import { trpc } from '@/lib/trpc/client'
import { Checklist } from '@/components/pms/Checklist'

interface ChecklistWithStatus {
  id: string
  nom: string
  type: string
  items: Array<{ id: string; description: string; obligatoire: boolean }>
  completed_today: boolean
}

export default function ChecklistsPage() {
  const today = new Date().toISOString().split('T')[0]
  const { data: checklists, refetch, isLoading } = trpc.pms.getChecklistsWithStatus.useQuery({ date: today })

  const completed = checklists?.filter(c => c.completed_today).length ?? 0
  const total = checklists?.length ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Checklists</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {total > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{completed}/{total}</span>
          </div>
        )}
      </div>

      {checklists && checklists.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Aucune checklist configurée</p>
          <p className="text-sm mt-1">Les checklists sont créées automatiquement à l&apos;inscription</p>
        </div>
      )}

      <div className="space-y-3">
        {(checklists as unknown as ChecklistWithStatus[] | undefined)?.map(checklist => (
          <Checklist
            key={checklist.id}
            checklist={checklist}
            date={today}
            onCompleted={() => refetch()}
          />
        ))}
      </div>
    </div>
  )
}
