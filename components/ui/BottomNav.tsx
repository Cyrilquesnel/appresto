'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, UtensilsCrossed, Camera, ShoppingCart, Settings, ImageIcon } from 'lucide-react'
import { PMSNavLink } from '@/components/PMSNavLink'
import { compressImage } from '@/lib/utils/image'
import { useDishCaptureStore } from '@/lib/store/dish-capture'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const linkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return `flex flex-col items-center gap-0.5 text-xs transition-colors ${
      isActive ? 'text-accent' : 'text-gray-400'
    }`
  }

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
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" aria-hidden="true" />
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" aria-hidden="true" />

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-evenly h-14">
          <Link href="/dashboard" className={linkClass('/dashboard')}>
            <BarChart3 size={22} strokeWidth={1.75} />
            <span>Tableau</span>
          </Link>

          <Link href="/plats" className={linkClass('/plats')}>
            <UtensilsCrossed size={22} strokeWidth={1.75} />
            <span>Plats</span>
          </Link>

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

          <Link href="/mercuriale" className={linkClass('/mercuriale')}>
            <ShoppingCart size={22} strokeWidth={1.75} />
            <span>Achats</span>
          </Link>

          <PMSNavLink />

          <Link href="/settings" className={linkClass('/settings')}>
            <Settings size={22} strokeWidth={1.75} />
            <span>Réglages</span>
          </Link>
        </div>
      </nav>

      {/* Backdrop */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setSheetOpen(false)} aria-hidden="true" />
      )}

      {/* Bottom sheet */}
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
    </>
  )
}
