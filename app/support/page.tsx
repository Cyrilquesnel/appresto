import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support — Le Rush',
  description: "Contactez le support de l'application Le Rush",
}

export default function SupportPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#06081A', color: '#e0e0e0' }}
    >
      <div className="max-w-md w-full text-center">
        <Link href="/" className="text-sm mb-10 inline-block" style={{ color: '#ED2939' }}>
          ← Le Rush
        </Link>

        <h1 className="text-3xl font-bold text-white mb-3">Support</h1>
        <p className="text-sm mb-10" style={{ color: '#888' }}>
          Une question, un problème ou une suggestion ?
        </p>

        <a
          href="mailto:cyril.quesnel@gmail.com?subject=Support%20Le%20Rush"
          className="inline-block w-full py-4 rounded-xl font-semibold text-white text-base transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#ED2939' }}
        >
          Nous écrire
        </a>

        <p className="mt-4 text-xs" style={{ color: '#555' }}>
          cyril.quesnel@gmail.com — réponse sous 24h
        </p>

        <div className="mt-10 text-xs" style={{ color: '#444' }}>
          <Link href="/privacy" style={{ color: '#666' }}>
            Politique de confidentialité
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs" style={{ color: '#333' }}>
        © {new Date().getFullYear()} SAS La Fabrique Alimentaire — Le Rush
      </footer>
    </main>
  )
}
