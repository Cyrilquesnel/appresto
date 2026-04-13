'use client'
import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

export function PushPermissionPrompt() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported' | 'loading'>('loading')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported')
    } else {
      setStatus(Notification.permission)
    }
  }, [])

  const subscribe = async () => {
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission)
      if (permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
    }
  }

  if (status === 'loading' || status === 'granted' || status === 'unsupported') return null

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4" data-testid="push-permission-prompt">
      <p className="text-sm font-medium text-indigo-900 mb-3">
        Activez les notifications pour recevoir les alertes PMS et rappels produits
      </p>
      <button
        onClick={subscribe}
        className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl"
        data-testid="enable-push"
      >
        Activer les notifications
      </button>
    </div>
  )
}
