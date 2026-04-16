import { create } from 'zustand'

interface NavigationGuardStore {
  isDirty: boolean
  setDirty: (v: boolean) => void
  clear: () => void
}

/**
 * Signale qu'un formulaire a des modifications non sauvegardées.
 * Utilisé par BottomNav pour intercepter la navigation et demander confirmation.
 */
export const useNavigationGuard = create<NavigationGuardStore>((set) => ({
  isDirty: false,
  setDirty: (v) => set({ isDirty: v }),
  clear: () => set({ isDirty: false }),
}))
