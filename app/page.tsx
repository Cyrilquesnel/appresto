import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: '#06081A' }}>
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6">
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: '#ED293920', color: '#ED2939' }}
          >
            Bêta privée
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">Le Rush</h1>
          <p className="text-lg text-gray-400 max-w-sm mx-auto leading-relaxed">
            Le copilote des pros de la restauration — fiches techniques, commandes fournisseurs et
            conformité HACCP en un seul endroit.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {['Fiches techniques', 'Mercuriale', 'Commandes auto', 'PMS / HACCP'].map((f) => (
            <span
              key={f}
              className="text-sm px-3 py-1 rounded-full text-gray-300"
              style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff18' }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Link
            href="/register"
            className="w-full py-4 rounded-xl font-semibold text-white text-base text-center transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: '#ED2939' }}
          >
            Créer mon compte
          </Link>
          <Link
            href="/login"
            className="w-full py-4 rounded-xl font-semibold text-base text-center transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: '#ffffff10',
              color: '#e0e0e0',
              border: '1px solid #ffffff20',
            }}
          >
            Se connecter
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-600">Accès bêta sur invitation uniquement.</p>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-700 space-y-1">
        <div>© {new Date().getFullYear()} SAS La Fabrique Alimentaire — Le Rush</div>
        <div className="flex justify-center gap-4">
          <a href="/privacy" className="hover:text-gray-500 transition-colors">
            Confidentialité
          </a>
          <a href="/support" className="hover:text-gray-500 transition-colors">
            Support
          </a>
        </div>
      </footer>
    </main>
  )
}
