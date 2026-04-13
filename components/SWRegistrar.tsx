'use client'
import { useEffect } from 'react'

export function SWRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-custom.js')
        .then(reg => console.log('[SW] Custom SW enregistré:', reg.scope))
        .catch(err => console.error('[SW] Échec enregistrement:', err))
    }
  }, [])

  return null
}
