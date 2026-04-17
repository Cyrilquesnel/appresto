'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import type { Prospect } from './types'

const STATUT_LABELS: Record<Prospect['statut'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  replied: 'Répondu',
  demo: 'Démo',
  client: 'Client',
  dead: 'Mort',
}

const STATUT_COLORS: Record<Prospect['statut'], string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  replied: 'bg-yellow-100 text-yellow-700',
  demo: 'bg-purple-100 text-purple-700',
  client: 'bg-green-100 text-green-700',
  dead: 'bg-red-100 text-red-700',
}

const INTENT_LABELS: Record<string, string> = {
  hot: 'Chaud',
  warm: 'Tiède',
  cold: 'Froid',
  unsubscribe: 'Désabo',
}

const INTENT_COLORS: Record<string, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-sky-100 text-sky-700',
  unsubscribe: 'bg-gray-100 text-gray-500',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">—</span>
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700'
      : score >= 50
        ? 'bg-orange-100 text-orange-700'
        : 'bg-red-100 text-red-700'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}
    >
      {score}
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface ProspectCardProps {
  prospect: Prospect
  onStatutChange: () => void
  onNoteAdded: () => void
  onOpenNote: (id: string) => void
}

export function ProspectCard({
  prospect,
  onStatutChange,
  onNoteAdded,
  onOpenNote,
}: ProspectCardProps) {
  const [showStatutMenu, setShowStatutMenu] = useState(false)

  const updateStatut = trpc.prospection.updateStatut.useMutation({
    onSuccess: () => {
      setShowStatutMenu(false)
      onStatutChange()
    },
  })

  const updateIntent = trpc.prospection.updateIntent.useMutation({
    onSuccess: onStatutChange,
  })

  const statutOptions: Prospect['statut'][] = [
    'new',
    'contacted',
    'replied',
    'demo',
    'client',
    'dead',
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{prospect.nom}</p>
          <p className="text-xs text-gray-500 truncate">
            {[prospect.ville, prospect.code_postal].filter(Boolean).join(' ')}
            {prospect.type_cuisine && (
              <span className="text-gray-400"> · {prospect.type_cuisine}</span>
            )}
          </p>
        </div>
        <ScoreBadge score={prospect.score} />
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Statut badge + dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatutMenu(!showStatutMenu)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${STATUT_COLORS[prospect.statut]}`}
          >
            {STATUT_LABELS[prospect.statut]}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showStatutMenu && (
            <div className="absolute z-10 left-0 top-7 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[130px]">
              {statutOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={updateStatut.isPending}
                  onClick={() => updateStatut.mutate({ id: prospect.id, statut: s })}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${s === prospect.statut ? 'font-semibold text-accent' : 'text-gray-700'}`}
                >
                  {STATUT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Intent badge */}
        {prospect.intent && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INTENT_COLORS[prospect.intent]}`}
          >
            {prospect.intent === 'hot' && '🔥 '}
            {INTENT_LABELS[prospect.intent]}
          </span>
        )}

        {/* Rating */}
        {prospect.rating !== null && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700">
            ★ {prospect.rating.toFixed(1)}
            {prospect.reviews_count !== null && (
              <span className="text-yellow-500 opacity-70">({prospect.reviews_count})</span>
            )}
          </span>
        )}
      </div>

      {/* WhatsApp sent + last reply */}
      <div className="space-y-1">
        {prospect.whatsapp_sent_at && (
          <p className="text-xs text-gray-500">
            WhatsApp envoyé le{' '}
            <span className="text-gray-700 font-medium">
              {formatDate(prospect.whatsapp_sent_at)}
            </span>
          </p>
        )}
        {prospect.last_reply_text && (
          <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-2 py-1">
            <span className="text-gray-400 mr-1">Réponse :</span>
            {prospect.last_reply_text}
          </p>
        )}
      </div>

      {/* Links + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {prospect.telephone && (
            <a
              href={`tel:${prospect.telephone}`}
              className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              {prospect.telephone}
            </a>
          )}
          {prospect.website && (
            <a
              href={prospect.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Web →
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenNote(prospect.id)}
          className="text-xs text-gray-500 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + Note
        </button>
      </div>

      {/* Existing note preview */}
      {prospect.notes && (
        <p className="text-xs text-gray-500 italic line-clamp-1">Note : {prospect.notes}</p>
      )}
    </div>
  )
}
