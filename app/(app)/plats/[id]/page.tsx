import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AllergenesDisplay } from '@/components/dishes/AllergenesDisplay'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function PlatDetailPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plat } = await supabase
    .from('plats')
    .select(
      `
      *,
      fiche_technique (
        id, nom_ingredient, grammage, unite, ordre
      )
    `
    )
    .eq('id', params.id)
    .single()

  if (!plat) notFound()

  const lignes = plat.fiche_technique
    ? [...plat.fiche_technique].sort((a, b) => a.ordre - b.ordre)
    : []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/plats" className="text-gray-500 hover:text-gray-700">
          ←
        </Link>
        <h1 className="text-xl font-bold flex-1 truncate">{plat.nom}</h1>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            plat.statut === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {plat.statut}
        </span>
      </div>

      {plat.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plat.photo_url}
          alt={plat.nom}
          className="w-full h-48 object-cover rounded-2xl mb-4"
        />
      )}

      {plat.cout_de_revient && (
        <div className="flex gap-4 mb-4 text-sm">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <span className="text-gray-500">Coût de revient</span>
            <p className="font-bold text-gray-900">{plat.cout_de_revient.toFixed(2)} €</p>
          </div>
          {plat.prix_vente_ht && (
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-gray-500">Prix vente HT</span>
              <p className="font-bold text-gray-900">{plat.prix_vente_ht.toFixed(2)} €</p>
            </div>
          )}
        </div>
      )}

      {lignes.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Ingrédients ({lignes.length})</h2>
          <div className="space-y-2">
            {lignes.map((ligne) => (
              <div
                key={ligne.id}
                className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-xl"
              >
                <span className="text-gray-900">{ligne.nom_ingredient}</span>
                <span className="text-sm text-gray-500">
                  {ligne.grammage} {ligne.unite}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plat.allergenes && plat.allergenes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Allergènes</h2>
          <AllergenesDisplay allergenes={plat.allergenes} />
        </div>
      )}

      <Link
        href={`/plats/${plat.id}/modifier`}
        className="block w-full text-center py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
      >
        Modifier la fiche
      </Link>
    </div>
  )
}
