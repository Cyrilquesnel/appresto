'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantStore } from '@/stores/restaurant'
import { trpc } from '@/lib/trpc/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useDashboardRealtime() {
  const restaurantId = useRestaurantStore((s) => s.restaurantId)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (!restaurantId) return

    const supabase = createClient()
    let channel: RealtimeChannel

    channel = supabase
      .channel(`dashboard-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ventes',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          utils.dashboard.get.invalidate()
          utils.dashboard.getVentesSemaine.invalidate()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plats',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          utils.dashboard.get.invalidate()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useDashboardRealtime] Connected')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, utils])
}
