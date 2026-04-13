'use client'
import { useState, useEffect } from 'react'

function isIOS() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('ios-prompt-dismissed')
    if (isIOS() && !isInStandaloneMode() && !dismissed) {
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4 pb-safe shadow-2xl"
      data-testid="ios-install-prompt"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="Mise en Place" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">Installer Mise en Place</p>
          <p className="text-xs text-gray-500 mt-1">
            Appuyez sur{' '}
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </span>{' '}
            puis « Sur l&apos;écran d&apos;accueil »
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('ios-prompt-dismissed', '1')
            setShow(false)
          }}
          className="text-gray-400 hover:text-gray-600 p-1"
          data-testid="ios-prompt-dismiss"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
