'use client'
import { useSessionTracker } from '@/hooks/use-session-tracker'
import { useRestaurantStore } from '@/stores/restaurant'

export function BetaSessionTracker() {
  const restaurantId = useRestaurantStore((s) => s.restaurantId)
  useSessionTracker(restaurantId)
  return null
}
