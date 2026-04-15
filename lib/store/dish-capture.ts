import { create } from 'zustand'

interface DishCaptureStore {
  pendingFile: File | null
  setPendingFile: (file: File) => void
  clear: () => void
}

/**
 * Stores a captured dish photo file temporarily so CameraFAB (in layout)
 * can pass it to /plats/nouveau without URL params.
 */
export const useDishCaptureStore = create<DishCaptureStore>((set) => ({
  pendingFile: null,
  setPendingFile: (file) => set({ pendingFile: file }),
  clear: () => set({ pendingFile: null }),
}))
