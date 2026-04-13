'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

interface ChecklistItem {
  id: string
  description: string
  obligatoire: boolean
}

interface ChecklistProps {
  checklist: {
    id: string
    nom: string
    type: string
    items: ChecklistItem[]
    completed_today: boolean
  }
  date: string
  onCompleted: () => void
}

export function Checklist({ checklist, date, onCompleted }: ChecklistProps) {
  const [itemStates, setItemStates] = useState<Record<string, boolean>>(
    Object.fromEntries(checklist.items.map((item) => [item.id, false]))
  )
  const [startTime] = useState(Date.now())

  const save = trpc.pms.saveChecklistCompletion.useMutation({
    onSuccess: () => onCompleted(),
  })

  const toggleItem = (id: string) => setItemStates((s) => ({ ...s, [id]: !s[id] }))

  const allRequired = checklist.items.filter((i) => i.obligatoire).every((i) => itemStates[i.id])

  const remainingRequired = checklist.items.filter((i) => i.obligatoire && !itemStates[i.id]).length

  const handleSubmit = () => {
    const duree = Math.round((Date.now() - startTime) / 60000)
    save.mutate({
      checklist_id: checklist.id,
      date,
      items_valides: checklist.items.map((item) => ({
        item_id: item.id,
        valide: itemStates[item.id] ?? false,
      })),
      duree_minutes: duree,
    })
  }

  if (checklist.completed_today) {
    return (
      <div
        className="bg-green-50 rounded-2xl p-4 border border-green-200"
        data-testid={`checklist-done-${checklist.id}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-700">{checklist.nom}</p>
            <p className="text-xs text-gray-500">Complétée aujourd&apos;hui</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
      data-testid={`checklist-${checklist.id}`}
    >
      <h3 className="font-semibold text-gray-900 mb-3">{checklist.nom}</h3>

      <div className="space-y-2 mb-4">
        {checklist.items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
              itemStates[item.id]
                ? 'bg-green-50 border border-green-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
            data-testid={`checklist-item-${item.id}`}
          >
            <span className={`text-xl ${itemStates[item.id] ? 'opacity-100' : 'opacity-20'}`}>
              ✓
            </span>
            <span
              className={`text-sm flex-1 ${itemStates[item.id] ? 'text-green-700 line-through' : 'text-gray-700'}`}
            >
              {item.description}
              {item.obligatoire && <span className="text-red-500 ml-1">*</span>}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allRequired || save.isPending}
        className="w-full py-4 bg-green-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
        data-testid={`validate-checklist-${checklist.id}`}
      >
        {save.isPending
          ? 'Enregistrement...'
          : allRequired
            ? '✓ Valider la checklist'
            : `${remainingRequired} item(s) requis restants`}
      </button>

      {save.isError && (
        <p className="text-sm text-red-500 text-center mt-2">{save.error.message}</p>
      )}
    </div>
  )
}
