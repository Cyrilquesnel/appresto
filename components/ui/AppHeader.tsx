import Link from 'next/link'

interface Props {
  title: string
  actions?: React.ReactNode
}

/**
 * Header réutilisable pour les pages principales.
 * Inclut un lien vers les paramètres (⚙️) en remplacement de l'onglet Settings retiré de la navbar.
 */
export function AppHeader({ title, actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <div className="flex items-center gap-2">
        {actions}
        <Link
          href="/settings"
          aria-label="Paramètres"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <span className="text-xl">⚙️</span>
        </Link>
      </div>
    </div>
  )
}
