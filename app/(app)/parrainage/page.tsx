'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-600' },
  registered: { label: 'Inscrit', color: 'bg-blue-100 text-blue-700' },
  converted: { label: 'Converti', color: 'bg-orange-100 text-orange-700' },
  credited: { label: 'Crédité', color: 'bg-green-100 text-green-700' },
}

export default function ParrainagePage() {
  const [copied, setCopied] = useState(false)
  const { data: myCode, isLoading: loadingCode } = trpc.referral.getMyCode.useQuery()
  const { data: stats, isLoading: loadingStats } = trpc.referral.getStats.useQuery()

  const code = myCode?.code ?? ''

  const appUrl = 'https://lerush.app'
  const messageWhatsApp = encodeURIComponent(
    `Salut ! J'utilise Le Rush pour gérer ma cuisine — vraiment top. Tu peux essayer 1 mois gratuit avec mon code ${code} sur ${appUrl} 🍽️`
  )
  const whatsappUrl = `https://wa.me/?text=${messageWhatsApp}`

  async function handleCopy() {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    if (!code) return
    if (navigator.share) {
      await navigator.share({
        title: 'Le Rush — 1 mois gratuit',
        text: `Utilise mon code ${code} sur ${appUrl} pour obtenir 1 mois offert !`,
        url: appUrl,
      })
    } else {
      handleCopy()
    }
  }

  const isLoading = loadingCode || loadingStats

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Programme Brigade</h1>
        <p className="text-sm text-gray-500 mt-1">
          Parrainez un restaurateur, gagnez chacun 1 mois offert
        </p>
      </div>

      {/* Hero */}
      <div className="bg-primary rounded-2xl p-5 text-white">
        <p className="text-sm font-medium opacity-80">Comment ça marche</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-lg leading-none">1.</span>
            <span>Partagez votre code à un restaurateur</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-lg leading-none">2.</span>
            <span>Il s&apos;inscrit et souscrit avec votre code</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-lg leading-none">3.</span>
            <span>
              Vous recevez <strong>1 mois gratuit</strong> dès son premier paiement
            </span>
          </div>
        </div>
      </div>

      {/* Votre code */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Votre code</p>

        {isLoading ? (
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center justify-center bg-gray-50 rounded-xl py-4 px-6 border border-dashed border-gray-300">
            <span className="text-2xl font-bold tracking-wider text-gray-900 font-mono">
              {code || '—'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!code}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {copied ? (
              <>
                <span>✓</span> Copié !
              </>
            ) : (
              <>
                <span>⎘</span> Copier
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!code}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40"
          >
            <span>↑</span> Partager
          </button>
        </div>

        {/* Lien WhatsApp */}
        {code && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Envoyer via WhatsApp
          </a>
        )}
      </div>

      {/* Compteur crédits */}
      {!loadingStats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <p className="text-xs text-green-700 uppercase tracking-wide font-medium">
              Mois gagnés
            </p>
            <p className="text-4xl font-bold text-green-800 mt-1">{stats?.credits_gagnes ?? 0}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <p className="text-xs text-blue-700 uppercase tracking-wide font-medium">Parrainages</p>
            <p className="text-4xl font-bold text-blue-800 mt-1">{stats?.total_parrainages ?? 0}</p>
          </div>
        </div>
      )}

      {/* Liste des referrals */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Mes parrainages</h2>

        {loadingStats ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !stats?.referrals.length ? (
          <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">Aucun parrainage pour l&apos;instant</p>
            <p className="text-xs text-gray-400 mt-1">Partagez votre code pour commencer</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.referrals.map((r) => {
              const s = STATUT_LABEL[r.statut] ?? STATUT_LABEL.pending
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {r.filleul_email ?? 'Lien non encore utilisé'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
