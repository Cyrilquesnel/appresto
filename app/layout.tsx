import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/providers'
import { SWRegistrar } from '@/components/SWRegistrar'
import { IOSInstallPrompt } from '@/components/IOSInstallPrompt'

export const metadata: Metadata = {
  title: 'Mise en Place',
  description: 'Gestion restauration — fiches techniques, commandes, PMS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mise en Place',
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
        <Providers>{children}</Providers>
        <SWRegistrar />
        <IOSInstallPrompt />
      </body>
    </html>
  )
}
