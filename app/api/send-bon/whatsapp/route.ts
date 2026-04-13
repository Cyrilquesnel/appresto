import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBonDeCommande, type BonLigneData } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  const { bon_id } = await req.json()

  // Charger le bon avec ses lignes et ingrédients (bon_de_commande_lignes)
  const { data: bon } = await supabase
    .from('bons_de_commande')
    .select(
      `
      id, total_ht, date_livraison_souhaitee, notes,
      fournisseur:fournisseurs(nom, contact_whatsapp),
      lignes:bon_de_commande_lignes(
        quantite, unite, prix_unitaire,
        ingredient:restaurant_ingredients(nom_custom, catalog:ingredients_catalog(nom))
      )
    `
    )
    .eq('id', bon_id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!bon) return NextResponse.json({ error: 'Bon non trouvé' }, { status: 404 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('nom')
    .eq('id', restaurantId)
    .single()

  // Formatter les lignes avec nom_produit résolu
  const lignes: BonLigneData[] = (
    (bon.lignes ?? []) as Array<{
      quantite: number
      unite: string
      prix_unitaire: number | null
      ingredient: { nom_custom: string | null; catalog: { nom: string } | null } | null
    }>
  ).map((l) => ({
    nom_produit: l.ingredient?.nom_custom ?? l.ingredient?.catalog?.nom ?? 'Produit',
    quantite: l.quantite,
    unite: l.unite,
    prix_unitaire: l.prix_unitaire ?? undefined,
  }))

  const fournisseur = bon.fournisseur as { nom: string; contact_whatsapp: string | null } | null
  if (!fournisseur?.contact_whatsapp) {
    return NextResponse.json({ error: 'Numéro WhatsApp du fournisseur manquant' }, { status: 400 })
  }

  const result = await sendBonDeCommande({
    id: bon.id,
    fournisseur: { nom: fournisseur.nom, contact_whatsapp: fournisseur.contact_whatsapp },
    date_livraison_souhaitee: bon.date_livraison_souhaitee,
    lignes,
    total_ht: bon.total_ht ?? 0,
    notes: bon.notes,
    restaurant_nom: restaurant?.nom ?? 'Mon restaurant',
  })

  return NextResponse.json(result)
}
