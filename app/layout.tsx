import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Black_Han_Sans, Poppins } from 'next/font/google'
import './globals.css'
import { Providers } from '@/providers'
import { SWRegistrar } from '@/components/SWRegistrar'
import { IOSInstallPrompt } from '@/components/IOSInstallPrompt'
import { PostHogProvider } from '@/components/PostHogProvider'

const blackHanSans = Black_Han_Sans({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Le Rush — Le copilote des pros de la restauration',
    template: '%s | Le Rush',
  },
  description:
    'Le Rush transforme une photo de plat en fiche technique, coûts, commande fournisseur et HACCP en moins de 2 minutes. Simple, tout au même endroit, un temps monstre gagné.',
  keywords: [
    'restaurant',
    'fiche technique',
    'food cost',
    'HACCP',
    'commandes fournisseurs',
    'PMS',
    'restauration',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://lerush.fr',
    siteName: 'Le Rush',
    images: [{ url: '/icons/icon-1024.png', width: 1024, height: 1024, alt: 'Le Rush' }],
  },
  twitter: { card: 'summary_large_image' },
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
  themeColor: '#06081A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${blackHanSans.variable} ${poppins.variable}`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </head>
      <body className={`antialiased ${blackHanSans.variable} ${poppins.variable} font-body`}>
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
