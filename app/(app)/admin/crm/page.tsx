'use client'

import { useEffect, useState, useCallback } from 'react'

type Statut = 'new' | 'contacted' | 'replied' | 'demo' | 'client' | 'dead'
type Intent = 'hot' | 'warm' | 'cold' | 'unsubscribe' | null

interface Prospect {
  id: string
  nom: string
  ville: string | null
  telephone: string | null
  score: number | null
  rating: number | null
  reviews_count: number | null
  statut: Statut
  intent: Intent
  last_reply_text: string | null
  last_reply_at: string | null
  whatsapp_sent_at: string | null
  created_at: string
}

interface Stats {
  total_leads: number
  contacts_sent: number
  replies: number
  reply_rate_pct: number
  hot_leads: number
  demos_booked: number
  conversions: number
}

const COLUMNS: { key: Statut; label: string; color: string }[] = [
  { key: 'new', label: 'Nouveaux', color: 'bg-gray-100 border-gray-300' },
  { key: 'contacted', label: 'Contactés', color: 'bg-blue-50 border-blue-200' },
  { key: 'replied', label: 'Répondu', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'demo', label: 'Démo 🔥', color: 'bg-orange-50 border-orange-200' },
  { key: 'client', label: 'Client ✓', color: 'bg-green-50 border-green-200' },
]

const INTENT_BADGE: Record<string, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-blue-100 text-blue-700',
  unsubscribe: 'bg-gray-100 text-gray-500',
}

export default function CrmPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    inserted: number
    skipped_duplicate: number
    skipped_chain: number
    errors: number
  } | null>(null)
  const [phoneFilter, setPhoneFilter] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [prospectsRes, statsRes] = await Promise.all([
        fetch('/api/crm/prospects?limit=500'),
        fetch('/api/crm/stats'),
      ])

      if (prospectsRes.ok) {
        const data = await prospectsRes.json()
        setProspects(data.prospects ?? [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (err) {
      console.error('CRM fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleImportCsv = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImporting(true)
      setImportResult(null)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/crm/import', { method: 'POST', body: form })
        const data = await res.json()
        if (res.ok) {
          setImportResult(data)
          fetchData()
        } else {
          alert(`Erreur import : ${data.error}\n${data.hint ?? ''}`)
        }
      } catch {
        alert("Erreur lors de l'import")
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    },
    [fetchData]
  )

  const filtered = prospects.filter((p) => {
    const matchText =
      p.nom.toLowerCase().includes(filter.toLowerCase()) ||
      (p.ville ?? '').toLowerCase().includes(filter.toLowerCase())
    const matchPhone = !phoneFilter || !!p.telephone
    return matchText && matchPhone
  })

  const byStatut = (statut: Statut) => filtered.filter((p) => p.statut === statut)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-orange-500 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">CRM Prospection</h1>
          <p className="text-gray-500 text-sm">Le Rush — pipeline d&apos;acquisition B2B</p>
        </div>
        <div className="flex gap-2 items-center">
          {importResult && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              +{importResult.inserted} ajoutés · {importResult.skipped_duplicate} doublons ·{' '}
              {importResult.skipped_chain} chaînes
            </span>
          )}
          <label
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${importing ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'}`}
          >
            {importing ? '⏳ Import...' : '⬆ Import CSV'}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCsv}
              disabled={importing}
            />
          </label>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <StatCard label="Total leads" value={stats.total_leads} />
          <StatCard label="Contactés" value={stats.contacts_sent} color="blue" />
          <StatCard label="Réponses" value={stats.replies} color="yellow" />
          <StatCard label="Taux réponse" value={`${stats.reply_rate_pct ?? 0}%`} color="purple" />
          <StatCard label="🔥 Chauds" value={stats.hot_leads} color="red" />
          <StatCard label="Démos" value={stats.demos_booked} color="orange" />
          <StatCard label="Clients" value={stats.conversions} color="green" />
        </div>
      )}

      {/* Barre de filtre + onglets */}
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Rechercher par nom ou ville..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[180px] max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <button
          onClick={() => setPhoneFilter(!phoneFilter)}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${phoneFilter ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
        >
          📞 Avec téléphone {phoneFilter && `(${filtered.filter((p) => p.telephone).length})`}
        </button>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'kanban' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'list' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
          >
            Liste
          </button>
        </div>
      </div>

      {/* Vue Kanban */}
      {activeTab === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const items = byStatut(col.key)
            return (
              <div
                key={col.key}
                className={`flex-shrink-0 w-72 border rounded-xl p-3 ${col.color}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="bg-white text-gray-600 text-xs px-2 py-0.5 rounded-full border">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                  {items.slice(0, 50).map((p) => (
                    <ProspectCard key={p.id} prospect={p} />
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun prospect</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vue Liste */}
      {activeTab === 'list' && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Restaurant</th>
                <th className="text-left px-4 py-3 font-medium">Ville</th>
                <th className="text-left px-4 py-3 font-medium">Téléphone</th>
                <th className="text-center px-4 py-3 font-medium">Score</th>
                <th className="text-center px-4 py-3 font-medium">Statut</th>
                <th className="text-center px-4 py-3 font-medium">Intent</th>
                <th className="text-left px-4 py-3 font-medium">Dernière réponse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 200).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.nom}</td>
                  <td className="px-4 py-3 text-gray-500">{p.ville ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.telephone ? (
                      <a
                        href={`https://wa.me/${p.telephone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:underline font-mono"
                      >
                        📞 +{p.telephone}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ScoreBadge score={p.score} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{p.statut}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.intent && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${INTENT_BADGE[p.intent] ?? ''}`}
                      >
                        {p.intent}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {p.last_reply_text ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProspectCard({ prospect: p }: { prospect: Prospect }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const canSendWhatsapp = !!p.telephone && p.statut === 'new' && !p.whatsapp_sent_at && !sent

  const handleSendWhatsapp = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/crm/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: p.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur : ${data.error ?? 'Erreur inconnue'}`)
      } else {
        setSent(true)
      }
    } catch {
      alert("Erreur réseau lors de l'envoi WhatsApp")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex-shrink-0 w-2 h-2 rounded-full ${p.telephone ? 'bg-green-400' : 'bg-gray-200'}`}
              title={p.telephone ? 'Téléphone disponible' : 'Pas de téléphone'}
            />
            <p className="font-medium text-sm truncate">{p.nom}</p>
          </div>
          <p className="text-xs text-gray-500 ml-3.5">{p.ville ?? '—'}</p>
        </div>
        <ScoreBadge score={p.score} />
      </div>
      {p.intent && (
        <span
          className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${INTENT_BADGE[p.intent] ?? ''}`}
        >
          {p.intent === 'hot' ? '🔥 ' : ''}
          {p.intent}
        </span>
      )}
      {p.last_reply_text && (
        <p className="mt-1.5 text-xs text-gray-600 italic truncate">
          &ldquo;{p.last_reply_text.slice(0, 60)}&rdquo;
        </p>
      )}
      {p.telephone && (
        <a
          href={`https://wa.me/${p.telephone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center gap-1 text-xs text-green-700 hover:underline"
        >
          <span>📞</span>
          <span className="font-mono">+{p.telephone}</span>
        </a>
      )}
      {p.rating && (
        <p className="mt-1 text-xs text-gray-400">
          ⭐ {p.rating} ({p.reviews_count} avis)
        </p>
      )}
      {sent ? (
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
          Envoyé ✓
        </span>
      ) : canSendWhatsapp ? (
        <button
          onClick={handleSendWhatsapp}
          disabled={sending}
          className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-200 hover:text-green-700 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <span className="animate-spin h-3 w-3 border border-gray-400 rounded-full border-t-transparent inline-block" />
              Envoi...
            </>
          ) : (
            <>📤 Envoyer</>
          )}
        </button>
      ) : null}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const color =
    score >= 80
      ? 'bg-green-100 text-green-700'
      : score >= 60
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-500'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0 ${color}`}>
      {score}
    </span>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  const cls = color ? colors[color] : 'bg-gray-50 border-gray-200 text-gray-700'
  return (
    <div className={`border rounded-xl p-3 ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  )
}
