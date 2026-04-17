import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Le Rush',
  description: "Politique de confidentialité de l'application Le Rush",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: '#06081A', color: '#e0e0e0' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm mb-8 inline-block" style={{ color: '#ED2939' }}>
          ← Le Rush
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Politique de confidentialité</h1>
        <p className="text-sm mb-10" style={{ color: '#666' }}>
          Dernière mise à jour : 17 avril 2026
        </p>

        <section className="space-y-8 text-sm leading-relaxed" style={{ color: '#aaa' }}>
          <div>
            <h2 className="text-base font-semibold text-white mb-2">1. Qui sommes-nous</h2>
            <p>
              Le Rush est édité par{' '}
              <strong className="text-white">SAS La Fabrique Alimentaire</strong>, société par
              actions simplifiée de droit français. Contact :{' '}
              <a href="mailto:cyril.quesnel@gmail.com" style={{ color: '#ED2939' }}>
                cyril.quesnel@gmail.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">2. Données collectées</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>Adresse email et informations de compte (nom de l&apos;établissement, type)</li>
              <li>
                Photos de plats et factures fournisseurs (analysées par IA, stockées dans votre
                espace)
              </li>
              <li>Relevés de températures et données PMS / HACCP</li>
              <li>Données de commandes et mercuriale fournisseurs</li>
              <li>Logs d&apos;utilisation anonymisés (pages visitées, erreurs)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">3. Finalités</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                Fournir les fonctionnalités de l&apos;application (fiches techniques, commandes,
                PMS)
              </li>
              <li>
                Analyse IA des photos pour l&apos;identification d&apos;ingrédients et allergènes
              </li>
              <li>Notifications push (relevés températures, alertes rappels produits)</li>
              <li>Amélioration du service et détection d&apos;erreurs</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">
              4. Hébergement et sous-traitants
            </h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <strong className="text-white">Supabase</strong> — base de données, hébergée en
                Europe (Frankfurt, Allemagne)
              </li>
              <li>
                <strong className="text-white">Vercel</strong> — hébergement frontend (région Paris,
                France)
              </li>
              <li>
                <strong className="text-white">Google (Gemini)</strong> — analyse IA des images,
                traitement sans stockage permanent
              </li>
              <li>
                <strong className="text-white">Anthropic (Claude)</strong> — enrichissement
                allergènes, traitement sans stockage permanent
              </li>
              <li>
                <strong className="text-white">Resend</strong> — envoi d&apos;emails transactionnels
              </li>
            </ul>
            <p className="mt-2">
              Aucune donnée n&apos;est vendue ou partagée avec des tiers à des fins commerciales.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">5. Durée de conservation</h2>
            <p>
              Vos données sont conservées pendant la durée de votre abonnement actif, puis 30 jours
              après résiliation pour vous permettre de récupérer vos données. Les relevés de
              températures PMS sont conservés 12 mois glissants conformément à la réglementation
              HACCP française.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">6. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="space-y-1 list-disc list-inside mt-2">
              <li>Accès à vos données personnelles</li>
              <li>Rectification des données inexactes</li>
              <li>Suppression de votre compte et de vos données</li>
              <li>Portabilité de vos données (export CSV/PDF disponible)</li>
              <li>Opposition au traitement</li>
            </ul>
            <p className="mt-2">
              Pour exercer ces droits :{' '}
              <a href="mailto:cyril.quesnel@gmail.com" style={{ color: '#ED2939' }}>
                cyril.quesnel@gmail.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">7. Cookies</h2>
            <p>
              L&apos;application utilise uniquement des cookies techniques nécessaires à
              l&apos;authentification (session Supabase) et au fonctionnement du service. Aucun
              cookie publicitaire ou de tracking tiers n&apos;est utilisé.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">8. Contact</h2>
            <p>
              Pour toute question relative à cette politique :{' '}
              <a href="mailto:cyril.quesnel@gmail.com" style={{ color: '#ED2939' }}>
                cyril.quesnel@gmail.com
              </a>
            </p>
          </div>
        </section>

        <footer
          className="mt-16 pt-8 border-t text-xs text-center"
          style={{ borderColor: '#ffffff15', color: '#444' }}
        >
          © {new Date().getFullYear()} SAS La Fabrique Alimentaire — Le Rush
        </footer>
      </div>
    </main>
  )
}
