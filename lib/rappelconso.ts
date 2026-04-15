const RAPPELCONSO_API =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records'

export interface RappelConsoRecord {
  rappelguid: string
  nom_produit_rappele: string
  nom_marque_produit: string
  categorie_produit: string
  sous_categorie_produit: string
  motif_rappel: string
  risques_pour_le_consommateur: string
  date_debut_fev: string
  date_fin_fev?: string
  lien_vers_information_complementaire?: string
}

export async function fetchRecentRappels(limit = 100): Promise<RappelConsoRecord[]> {
  const url = new URL(RAPPELCONSO_API)
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('order_by', 'date_debut_fev DESC')
  url.searchParams.set(
    'select',
    'rappelguid,nom_produit_rappele,nom_marque_produit,categorie_produit,sous_categorie_produit,motif_rappel,risques_pour_le_consommateur,date_debut_fev,date_fin_fev,lien_vers_information_complementaire'
  )

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  url.searchParams.set('where', `date_debut_fev >= "${sevenDaysAgo.toISOString().split('T')[0]}"`)

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'LeRush/1.0 contact@onrush.app' },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`RappelConso API error: ${response.status}`)
  }

  const data = await response.json()
  return (data.results ?? []) as RappelConsoRecord[]
}

export function matchRappelWithIngredients(
  rappel: RappelConsoRecord,
  ingredients: { id: string; nom: string }[]
): { ingredient_id: string; nom: string } | null {
  const searchText = `${rappel.nom_produit_rappele} ${rappel.nom_marque_produit}`.toLowerCase()

  for (const ingredient of ingredients) {
    const ingredientNom = ingredient.nom.toLowerCase()
    if (searchText.includes(ingredientNom) || ingredientNom.includes(searchText.split(' ')[0])) {
      return { ingredient_id: ingredient.id, nom: ingredient.nom }
    }
  }

  return null
}
