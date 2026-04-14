'use client'
// Hydrate le Zustand store avec le restaurant de l'utilisateur connecté.
// Monté une seule fois dans le layout app — transparent pour l'UI.

import { useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRestaurantStore } from '@/stores/restaurant'

export function RestaurantInitializer() {
  const setRestaurant = useRestaurantStore((s) => s.setRestaurant)
  const restaurantId = useRestaurantStore((s) => s.restaurantId)

  const { data } = trpc.dashboard.getMyRestaurant.useQuery(undefined, {
    enabled: !restaurantId, // ne requête que si le store est vide
    retry: 1,
  })

  useEffect(() => {
    if (data?.id && data?.nom) {
      setRestaurant(data.id, data.nom)
    }
  }, [data, setRestaurant])

  return null
}
