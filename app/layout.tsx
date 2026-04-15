import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from '@/providers'
import { SWRegistrar } from '@/components/SWRegistrar'
import { IOSInstallPrompt } from '@/components/IOSInstallPrompt'
import { PostHogProvider } from '@/components/PostHogProvider'

export const metadata: Metadata = {
  title: 'Le Rush',
  description: 'Le copilote des pros de la restauration — fiches techniques, commandes, PMS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Le Rush',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a3a2a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <PostHogProvider>
            <Providers>{children}</Providers>
          </PostHogProvider>
        </Suspense>
        <SWRegistrar />
        <IOSInstallPrompt />
      </body>
    </html>
  )
}
