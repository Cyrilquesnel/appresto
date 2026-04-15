'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/utils/image'
import { useDishCaptureStore } from '@/lib/store/dish-capture'

export function CameraFAB() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSheetOpen(false)
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected
    e.target.value = ''

    const processed = file.size > 2 * 1024 * 1024 ? await compressImage(file) : file
    useDishCaptureStore.getState().setPendingFile(processed)
    router.push('/plats/nouveau')
  }

  return (
    <>
      {/* Hidden file inputs — règle iOS Safari : capture=environment obligatoire pour la caméra */}
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

      {/* FAB — positionné 8px au-dessus de la navbar (3.5rem = 56px = h-14) */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Photographier un plat"
        className="fixed left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-accent shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-white text-2xl leading-none">📷</span>
      </button>

      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
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
            <span className="text-2xl">📷</span>
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
            <span className="text-2xl">🖼️</span>
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
