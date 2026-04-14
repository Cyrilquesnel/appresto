'use client'
import { useState, useEffect } from 'react'
import { getQueuedCount } from '@/lib/pms-offline'

export function OfflineBadge() {
  const [count, setCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const updateCount = async () => {
      try {
        const c = await getQueuedCount()
        setCount(c)
      } catch {
        setCount(0)
      }
    }

    updateCount()
    const interval = setInterval(updateCount, 5000)

    const handleOnline = () => {
      setIsOnline(true)
      updateCount()
    }
    const handleOffline = () => setIsOnline(false)
    const handleSWMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PMS_SYNC_COMPLETE') updateCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  if (count === 0 && isOnline) return null

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-3 text-sm font-medium flex items-center gap-2 shadow-lg ${
        !isOnline ? 'bg-gray-800 text-white' : 'bg-yellow-500 text-white'
      }`}
      data-testid="offline-badge"
    >
      {!isOnline ? (
        <>
          <span>📡</span>
          <span>
            Mode hors-ligne
            {count > 0
              ? ` — ${count} relevé(s) en attente`
              : ' — les relevés seront synchronisés au retour du réseau'}
          </span>
        </>
      ) : count > 0 ? (
        <>
          <span>🔄</span>
          <span>{count} relevé(s) en cours de synchronisation...</span>
        </>
      ) : null}
    </div>
  )
}
