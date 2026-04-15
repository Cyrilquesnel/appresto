'use client'
import { useRef } from 'react'
import { compressImage } from '@/lib/utils/image'

interface Props {
  onCapture: (file: File) => void
  preview?: string | null
}

export function DishCamera({ onCapture, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onCapture(file.size > 2 * 1024 * 1024 ? await compressImage(file) : file)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleCapture}
        className="hidden"
        data-testid="dish-file-input"
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Plat"
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: '300px' }}
          onClick={() => inputRef.current?.click()}
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500"
          data-testid="camera-btn"
        >
          <span className="text-4xl">📸</span>
          <span className="text-sm font-medium">Photographier le plat</span>
          <span className="text-xs text-gray-400">ou choisir depuis la galerie</span>
        </button>
      )}
    </div>
  )
}
