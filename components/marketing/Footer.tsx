import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer style={{ backgroundColor: '#06081A' }} className="border-t border-white/5">
      {/* Barre tricolore */}
      <div className="flex h-1">
        <div className="flex-1" style={{ backgroundColor: '#002395' }} />
        <div className="flex-1" style={{ backgroundColor: '#ffffff', opacity: 0.4 }} />
        <div className="flex-1" style={{ backgroundColor: '#ED2939' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/icons/icon-192.png"
                alt="Le Rush"
                width={36}
                height={36}
                className="rounded-rush-lg"
              />
              <span className="font-display text-white text-xl tracking-wide">Le Rush</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              SAS La Fabrique Alimentaire
              <br />
              Paris, France
            </p>
            <a
              href="mailto:contact@lerush.fr"
              className="text-sm hover:text-white transition-colors"
              style={{ color: '#9ca3af' }}
            >
              contact@lerush.fr
            </a>
          </div>

          {/* Produit */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Produit</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/#fonctionnalites', label: 'Fiches techniques' },
                { href: '/#fonctionnalites', label: 'Commandes auto' },
                { href: '/#fonctionnalites', label: 'Dashboard financier' },
                { href: '/#haccp', label: 'PMS / HACCP' },
                { href: '/demo', label: 'Tarifs & Bêta' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ressources */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Ressources</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/blog', label: 'Blog' },
                { href: '/blog/haccp-restauration-guide-complet-2026', label: 'Guide HACCP' },
                { href: '/blog/food-cost-calcul-restaurant', label: 'Calculer son food cost' },
                {
                  href: '/blog/automatiser-commandes-fournisseurs-restaurant',
                  label: 'Automatiser les commandes',
                },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Légal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/privacy', label: 'Confidentialité' },
                { href: '/support', label: 'Support' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-gray-700">
            © {new Date().getFullYear()} SAS La Fabrique Alimentaire — Le Rush · Tous droits
            réservés
          </p>
        </div>
      </div>
    </footer>
  )
}
