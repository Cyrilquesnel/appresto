'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { ProspectCard } from './ProspectCard'
import type { Prospect } from './types'

type Statut = 'all' | 'new' | 'contacted' | 'replied' | 'demo' | 'client' | 'dead'

const TABS: { label: string; value: Statut }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Nouveaux', value: 'new' },
  { label: 'Contactés', value: 'contacted' },
  { label: 'Répondus', value: 'replied' },
  { label: 'Démo', value: 'demo' },
  { label: 'Client', value: 'client' },
  { label: 'Dead', value: 'dead' },
]

const PAGE_SIZE = 25

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
        <div className="h-5 w-8 bg-gray-200 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 w-full bg-gray-100 rounded" />
    </div>
  )
}

function NoteModal({
  prospectId,
  onClose,
  onSaved,
}: {
  prospectId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState('')
  const addNote = trpc.prospection.addNote.useMutation({
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">Ajouter une note</h2>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Votre note..."
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!note.trim() || addNote.isPending}
            onClick={() => addNote.mutate({ id: prospectId, note: note.trim() })}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {addNote.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProspectionPage() {
  const [statutFilter, setStatutFilter] = useState<Statut>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [noteModalId, setNoteModalId] = useState<string | null>(null)

  const queryStatut = statutFilter === 'all' ? undefined : statutFilter

  const { data, isLoading, refetch } = trpc.prospection.list.useQuery({
    statut: queryStatut,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
  })

  const { data: counts } = trpc.prospection.countByStatut.useQuery()
  const { data: stats } = trpc.prospection.stats.useQuery()

  const prospects = (data?.prospects ?? []) as Prospect[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const replyRate =
    counts && counts.contacted + counts.replied + counts.demo + counts.client > 0
      ? Math.round(
          ((counts.replied + counts.demo + counts.client) /
            (counts.contacted + counts.replied + counts.demo + counts.client)) *
            100
        )
      : 0

  function handleTabChange(val: Statut) {
    setStatutFilter(val)
    setPage(0)
  }

  function handleSearch(val: string) {
    setSearch(val)
    setPage(0)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Prospection</h1>
        {stats?.week_label && <span className="text-xs text-gray-400">{stats.week_label}</span>}
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {counts
              ? counts.new +
                counts.contacted +
                counts.replied +
                counts.demo +
                counts.client +
                counts.dead
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Leads</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{counts?.contacted ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Contactés</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{counts?.replied ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Réponses</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{counts ? `${replyRate}%` : '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Taux rép.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats?.hot_leads ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hot 🔥</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{counts?.client ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Clients</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom, ville..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
        />
        {search && (
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              statutFilter === tab.value
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && counts?.[tab.value] !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  statutFilter === tab.value ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                }`}
              >
                {counts[tab.value as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Prospects list */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : prospects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">Aucun prospect trouvé</p>
            {search && (
              <button
                type="button"
                onClick={() => handleSearch('')}
                className="text-xs text-accent mt-2"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          prospects.map((prospect) => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              onStatutChange={() => refetch()}
              onNoteAdded={() => refetch()}
              onOpenNote={(id) => setNoteModalId(id)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between py-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Précédent
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} / {totalPages} · {total} prospects
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Note modal */}
      {noteModalId && (
        <NoteModal
          prospectId={noteModalId}
          onClose={() => setNoteModalId(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  )
}
