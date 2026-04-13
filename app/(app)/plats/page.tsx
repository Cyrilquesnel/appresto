import { createClient } from '@/lib/supabase/server'

export default async function PlatsPage() {
  const supabase = createClient()
  const { data: plats } = await supabase
    .from('plats')
    .select('id, nom, photo_url, cout_de_revient, statut')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Mes plats</h1>
        <a
          href="/plats/nouveau"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-accent)' }}
          data-testid="add-dish-btn"
        >
          + Nouveau
        </a>
      </div>
      {(!plats || plats.length === 0) && (
        <p className="text-gray-500 text-center mt-8">
          Aucun plat — photographiez votre premier plat !
        </p>
      )}
      {plats?.map((plat) => (
        <a key={plat.id} href={`/plats/${plat.id}`} className="block border rounded-xl p-3 mb-3">
          <div className="flex justify-between">
            <span className="font-medium">{plat.nom}</span>
            {plat.cout_de_revient && (
              <span className="text-sm text-gray-500">{plat.cout_de_revient.toFixed(2)}€</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{plat.statut}</span>
        </a>
      ))}
    </div>
  )
}
