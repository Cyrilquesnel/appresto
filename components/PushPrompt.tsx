'use client'
import { useEffect, useState } from 'react'

export function PushPrompt() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      Notification.permission !== 'default'
    )
      return
    // Montrer le prompt après 5s sur la page (moins intrusif)
    const timer = setTimeout(() => setShow(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (!show) return null

  async function handleAllow() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setShow(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
    } catch (e) {
      console.error('[PushPrompt]', e)
    } finally {
      setShow(false)
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">Activer les notifications</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Alertes rappels produits, rappels PMS températures
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="text-gray-400 text-sm"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleAllow}
          disabled={loading}
          className="flex-1 py-2 bg-accent text-white text-sm font-semibold rounded-xl disabled:opacity-50"
        >
          {loading ? 'Activation...' : 'Activer'}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
