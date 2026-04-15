import Link from 'next/link'

export default function PMSPage() {
  const modules = [
    {
      href: '/pms/temperatures',
      icon: '🌡',
      title: 'Températures',
      desc: 'Relevés équipements, alertes hors-plage',
    },
    {
      href: '/pms/checklists',
      icon: '✅',
      title: 'Checklists',
      desc: 'Pré-service, post-service, nettoyage',
    },
    {
      href: '/pms/receptions',
      icon: '📦',
      title: 'Réceptions',
      desc: 'DLC, numéros lot, traçabilité',
    },
    {
      href: '/pms/haccp',
      icon: '🔬',
      title: 'Plan HACCP',
      desc: 'Points critiques générés par IA',
    },
    {
      href: '/pms/rappels',
      icon: '🚨',
      title: 'Alertes rappels',
      desc: 'RappelConso, produits concernés',
    },
    {
      href: '/pms/export',
      icon: '📄',
      title: 'Export DDPP',
      desc: 'Registre HACCP — Mode Inspecteur',
    },
    {
      href: '/plats/allergenes',
      icon: '⚠️',
      title: 'Allergènes',
      desc: 'Feuille conformité Décret 2015-447',
    },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">PMS / HACCP</h1>
      <p className="text-sm text-gray-400 mb-6">Plan de Maîtrise Sanitaire</p>

      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-accent/30 transition-colors"
          >
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="font-semibold text-gray-900 text-sm">{m.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
