'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantStore } from '@/stores/restaurant'

export function RealtimeIndicator() {
  const [connected, setConnected] = useState(false)
  const restaurantId = useRestaurantStore(s => s.restaurantId)

  useEffect(() => {
    if (!restaurantId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`indicator-${restaurantId}`)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  return (
    <div
      className="flex items-center gap-1.5"
      title={connected ? 'Données en temps réel' : 'Reconnexion...'}
    >
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      {!connected && <span className="text-xs text-gray-400">Reconnexion...</span>}
    </div>
  )
}
