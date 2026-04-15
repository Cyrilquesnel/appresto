'use client'
import { useRef } from 'react'
import { trpc } from '@/lib/trpc/client'

const ALLERGENES_14 = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'crustaces', label: 'Crustacés' },
  { key: 'oeufs', label: 'Œufs' },
  { key: 'poisson', label: 'Poisson' },
  { key: 'arachides', label: 'Arachides' },
  { key: 'soja', label: 'Soja' },
  { key: 'lait', label: 'Lait' },
  { key: 'fruits_a_coque', label: 'Fruits à coque' },
  { key: 'celeri', label: 'Céleri' },
  { key: 'moutarde', label: 'Moutarde' },
  { key: 'sesame', label: 'Sésame' },
  { key: 'sulfites', label: 'Sulfites' },
  { key: 'lupin', label: 'Lupin' },
  { key: 'mollusques', label: 'Mollusques' },
] as const

export default function AllergenesPage() {
  const { data: plats, isLoading } = trpc.fiches.list.useQuery()
  const printRef = useRef<HTMLDivElement>(null)

  const platsActifs = (plats ?? []).filter((p) => p.statut === 'actif')
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const handlePrint = () => window.print()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-full px-4 py-6">
      {/* Header actions — masqué à l'impression */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-xl font-bold">Feuille d&apos;allergènes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Conformité Décret n°2015-447 — {platsActifs.length} plat
            {platsActifs.length > 1 ? 's' : ''} actif{platsActifs.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl"
        >
          🖨 Imprimer / PDF
        </button>
      </div>

      {platsActifs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-2xl mb-2">🍽</p>
          <p className="font-medium">Aucun plat actif</p>
          <p className="text-sm mt-1">
            Passez vos plats en statut &quot;Actif&quot; pour les voir ici.
          </p>
        </div>
      )}

      {platsActifs.length > 0 && (
        <div ref={printRef}>
          {/* En-tête document imprimable */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-center">Fiche Allergènes</h1>
            <p className="text-center text-sm text-gray-500 mt-1">
              Conforme au Règlement UE n°1169/2011 et Décret n°2015-447 — Mise à jour : {today}
            </p>
          </div>

          {/* Matrice */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 border border-gray-300 font-semibold text-sm min-w-[160px] sticky left-0 bg-gray-100 z-10">
                    Plat
                  </th>
                  {ALLERGENES_14.map((a) => (
                    <th
                      key={a.key}
                      className="border border-gray-300 px-1 py-2 font-medium text-center"
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        minWidth: '32px',
                        height: '120px',
                      }}
                    >
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platsActifs.map((plat, i) => {
                  const allergenes = (plat.allergenes as string[] | null) ?? []
                  return (
                    <tr key={plat.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td
                        className={`px-3 py-2 border border-gray-300 font-medium sticky left-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        {plat.nom}
                      </td>
                      {ALLERGENES_14.map((a) => {
                        const present = allergenes.some(
                          (al) =>
                            al.toLowerCase().replace(/[^a-z]/g, '') === a.key.replace(/_/g, '') ||
                            al.toLowerCase().includes(a.key.replace(/_/g, ''))
                        )
                        return (
                          <td key={a.key} className="border border-gray-300 text-center py-2">
                            {present ? (
                              <span className="text-red-600 font-bold text-base">●</span>
                            ) : (
                              <span className="text-gray-200">○</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
            <span>
              <span className="text-red-600 font-bold">●</span> Contient l&apos;allergène
            </span>
            <span>
              <span className="text-gray-300">○</span> Ne contient pas
            </span>
          </div>

          <p className="mt-6 text-xs text-gray-400 print:mt-8">
            Document généré automatiquement par Le Rush · {today}
          </p>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          #allergenes-print,
          #allergenes-print * {
            visibility: visible;
          }
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
