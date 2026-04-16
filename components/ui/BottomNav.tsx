'use client'
import { useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, UtensilsCrossed, Camera, ShoppingCart, Settings, ImageIcon } from 'lucide-react'
import { PMSNavLink } from '@/components/PMSNavLink'
import { compressImage } from '@/lib/utils/image'
import { useDishCaptureStore } from '@/lib/store/dish-capture'
import { useNavigationGuard } from '@/lib/store/navigation-guard'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const { isDirty, clear } = useNavigationGuard()

  const linkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return `flex flex-col items-center gap-0.5 text-xs transition-colors ${
      isActive ? 'text-accent' : 'text-gray-400'
    }`
  }

  const handleNavClick = (href: string) => {
    if (isDirty) {
      setPendingHref(href)
    } else {
      router.push(href)
    }
  }

  const confirmLeave = () => {
    if (!pendingHref) return
    clear()
    router.push(pendingHref)
    setPendingHref(null)
  }

  const cancelLeave = () => setPendingHref(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSheetOpen(false)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const processed = file.size > 2 * 1024 * 1024 ? await compressImage(file) : file
    useDishCaptureStore.getState().setPendingFile(processed)
    router.push('/plats/nouveau')
  }

  return (
    <>
      {/* Hidden file inputs — règle iOS Safari */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
      />

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-evenly h-14">
          <button
            type="button"
            onClick={() => handleNavClick('/dashboard')}
            className={linkClass('/dashboard')}
          >
            <BarChart3 size={22} strokeWidth={1.75} />
            <span>Tableau</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('/plats')}
            className={linkClass('/plats')}
          >
            <UtensilsCrossed size={22} strokeWidth={1.75} />
            <span>Plats</span>
          </button>

          {/* Bouton photo — inline, même niveau que les autres */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Photographier un plat"
            className="flex flex-col items-center gap-0.5 text-xs text-gray-400"
          >
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <Camera size={20} strokeWidth={1.75} className="text-white" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('/mercuriale')}
            className={linkClass('/mercuriale')}
          >
            <ShoppingCart size={22} strokeWidth={1.75} />
            <span>Achats</span>
          </button>

          <PMSNavLink onNavigate={handleNavClick} />

          <button
            type="button"
            onClick={() => handleNavClick('/settings')}
            className={linkClass('/settings')}
          >
            <Settings size={22} strokeWidth={1.75} />
            <span>Réglages</span>
          </button>
        </div>
      </nav>

      {/* Backdrop photo sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet — options photo */}
      <div
        role="dialog"
        aria-label="Options photo"
        className={`fixed left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
        <p className="text-center text-sm font-semibold text-gray-700 mb-4 px-4">Ajouter un plat</p>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-3 w-full py-4 px-4 rounded-2xl bg-gray-50 text-left active:bg-gray-100"
          >
            <Camera size={24} strokeWidth={1.75} className="text-accent" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Photographier un plat</p>
              <p className="text-xs text-gray-400">Ouvrir la caméra</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-3 w-full py-4 px-4 rounded-2xl bg-gray-50 text-left active:bg-gray-100"
          >
            <ImageIcon size={24} strokeWidth={1.75} className="text-accent" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Importer depuis la galerie</p>
              <p className="text-xs text-gray-400">Choisir une photo existante</p>
            </div>
          </button>
        </div>
      </div>

      {/* Backdrop guard */}
      {pendingHref && <div className="fixed inset-0 z-[80] bg-black/40" aria-hidden="true" />}

      {/* Bottom sheet — confirmation modifications non sauvegardées */}
      <div
        role="dialog"
        aria-label="Modifications non sauvegardées"
        className={`fixed left-0 right-0 z-[90] bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ${
          pendingHref ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-6 pb-6">
          <p className="text-center text-sm font-semibold text-gray-900 mb-1">
            Modifications non sauvegardées
          </p>
          <p className="text-center text-xs text-gray-500 mb-6">
            Si tu quittes maintenant, tes modifications seront perdues.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={cancelLeave}
              className="w-full py-3.5 rounded-2xl bg-accent text-white text-sm font-semibold active:opacity-80"
            >
              Rester et sauvegarder
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
            >
              Quitter sans sauvegarder
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
