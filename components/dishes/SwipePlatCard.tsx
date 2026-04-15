'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

const SWIPE_THRESHOLD = 40 // px pour déclencher l'ouverture
const ACTIONS_WIDTH = 130 // largeur totale des boutons révélés

interface Plat {
  id: string
  nom: string
  statut: string
  cout_de_revient?: number | null
}

interface Props {
  plat: Plat
  onMutated: () => void
}

export function SwipePlatCard({ plat, onMutated }: Props) {
  const utils = trpc.useUtils()
  const updateStatut = trpc.plats.updateStatut.useMutation({
    onSuccess: () => {
      utils.plats.list.invalidate()
      onMutated()
    },
  })
  const deletePlat = trpc.plats.delete.useMutation({
    onSuccess: () => {
      utils.plats.list.invalidate()
      onMutated()
    },
  })

  // Swipe state
  const startX = useRef<number | null>(null)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0) // 0 = fermé, -ACTIONS_WIDTH = ouvert
  const [isAnimating, setIsAnimating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOpen = offset <= -ACTIONS_WIDTH / 2

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    currentX.current = offset
    setIsAnimating(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return
    const delta = e.touches[0].clientX - startX.current
    const next = Math.min(0, Math.max(-ACTIONS_WIDTH, currentX.current + delta))
    setOffset(next)
  }

  const handleTouchEnd = () => {
    setIsAnimating(true)
    const shouldOpen = offset < -SWIPE_THRESHOLD
    setOffset(shouldOpen ? -ACTIONS_WIDTH : 0)
    startX.current = null
    if (!shouldOpen) setConfirmDelete(false)
  }

  const handleToggleStatut = (e: React.MouseEvent) => {
    e.preventDefault()
    const next = plat.statut === 'actif' ? 'brouillon' : 'actif'
    updateStatut.mutate({ id: plat.id, statut: next })
    setOffset(0)
    setIsAnimating(true)
  }

  const handleDeleteTap = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirmDelete) {
      setConfirmDelete(true)
      // reset automatiquement après 3s si pas confirmé
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    deletePlat.mutate({ id: plat.id })
  }

  // Tap sur le badge statut (sans swipe) = toggle direct
  const handleBadgeTap = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOpen) {
      setOffset(0)
      setIsAnimating(true)
      return
    }
    const next = plat.statut === 'actif' ? 'brouillon' : 'actif'
    updateStatut.mutate({ id: plat.id, statut: next })
  }

  return (
    <div className="relative overflow-hidden rounded-xl mb-3">
      {/* Boutons d'action révélés au swipe */}
      <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: ACTIONS_WIDTH }}>
        {/* Toggle statut */}
        <button
          type="button"
          onClick={handleToggleStatut}
          disabled={updateStatut.isPending}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-green-500 text-white text-xs font-medium active:bg-green-600 disabled:opacity-60"
        >
          {plat.statut === 'actif' ? (
            <ToggleLeft size={20} strokeWidth={1.75} />
          ) : (
            <ToggleRight size={20} strokeWidth={1.75} />
          )}
          <span>{plat.statut === 'actif' ? 'Brouillon' : 'Activer'}</span>
        </button>

        {/* Supprimer */}
        <button
          type="button"
          onClick={handleDeleteTap}
          disabled={deletePlat.isPending}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-colors disabled:opacity-60 ${
            confirmDelete ? 'bg-red-700' : 'bg-red-500 active:bg-red-600'
          }`}
        >
          <Trash2 size={20} strokeWidth={1.75} />
          <span>{confirmDelete ? 'Confirmer' : 'Supprimer'}</span>
        </button>
      </div>

      {/* Card principale */}
      <Link
        href={`/plats/${plat.id}`}
        className="block border border-gray-200 rounded-xl p-3 bg-white hover:border-accent/30 transition-colors"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 0.2s ease-out' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // Bloquer la navigation si la card est ouverte
          if (isOpen) {
            e.preventDefault()
            setOffset(0)
            setIsAnimating(true)
          }
        }}
      >
        <div className="flex justify-between items-start">
          <span className="font-medium text-gray-900 truncate pr-2">{plat.nom}</span>
          {plat.cout_de_revient != null && (
            <span className="text-sm text-gray-500 shrink-0">
              {plat.cout_de_revient.toFixed(2)} €
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {/* Badge cliquable = toggle direct */}
          <button
            type="button"
            onClick={handleBadgeTap}
            disabled={updateStatut.isPending}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-60 ${
              plat.statut === 'actif'
                ? 'bg-green-100 text-green-700 active:bg-green-200'
                : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            {updateStatut.isPending ? '…' : plat.statut === 'actif' ? 'Actif' : 'Brouillon'}
          </button>
          <span className="text-xs text-gray-300">← swipe</span>
        </div>
      </Link>
    </div>
  )
}
