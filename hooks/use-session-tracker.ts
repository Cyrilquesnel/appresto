'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const PING_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

export function useSessionTracker(restaurantId: string | null) {
  const sessionIdRef = useRef<string | null>(null)
  const pathname = usePathname()

  // Création de la session au montage
  useEffect(() => {
    if (!restaurantId) return

    fetch('/api/beta/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, page: pathname }),
    })
      .then((r) => r.json())
      .then((data: { session_id: string }) => {
        sessionIdRef.current = data.session_id
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  // Mise à jour de la page active à chaque navigation
  useEffect(() => {
    if (!sessionIdRef.current || !restaurantId) return
    fetch('/api/beta/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionIdRef.current,
        restaurant_id: restaurantId,
        page: pathname,
      }),
    }).catch(() => {})
  }, [pathname, restaurantId])

  // Heartbeat toutes les 2 minutes pour maintenir la session active
  useEffect(() => {
    if (!restaurantId) return
    const interval = setInterval(() => {
      if (!sessionIdRef.current) return
      fetch('/api/beta/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          restaurant_id: restaurantId,
        }),
      }).catch(() => {})
    }, PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [restaurantId])
}
