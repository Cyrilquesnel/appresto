import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RestaurantStore {
  restaurantId: string | null
  restaurantNom: string | null
  setRestaurant: (id: string, nom: string) => void
  clearRestaurant: () => void
}

export const useRestaurantStore = create<RestaurantStore>()(
  persist(
    (set) => ({
      restaurantId: null,
      restaurantNom: null,
      setRestaurant: (id, nom) => set({ restaurantId: id, restaurantNom: nom }),
      clearRestaurant: () => set({ restaurantId: null, restaurantNom: null }),
    }),
    { name: 'restaurant-store' }
  )
)
