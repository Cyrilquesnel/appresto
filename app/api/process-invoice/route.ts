import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractInvoiceData, matchIngredient } from '@/lib/ai/invoice-ocr'
import { invoiceOCRLimiter } from '@/lib/upstash'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  // Rate limit: 50 OCR/jour/restaurant
  if (invoiceOCRLimiter) {
    const { success } = await invoiceOCRLimiter.limit(`invoice_ocr:${restaurantId}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Limite OCR atteinte (50/jour). Réessayez demain.' },
        { status: 429 }
      )
    }
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'Image requise' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Fichier image requis' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image trop lourde (max 20MB)' }, { status: 400 })
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  // Extraire données facture via Gemini
  const invoiceData = await extractInvoiceData(imageBase64, file.type)

  // Récupérer ingrédients du restaurant (nom_custom > nom catalogue)
  const { data: ings } = await supabase
    .from('restaurant_ingredients')
    .select('id, nom_custom, catalog:ingredients_catalog(nom)')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  // Normaliser en { id, nom } pour le matching
  const ingredients = (ings ?? [])
    .map((i) => ({
      id: i.id,
      nom: i.nom_custom ?? (i.catalog as { nom: string } | null)?.nom ?? '',
    }))
    .filter((i) => i.nom !== '')

  // Matcher chaque ligne de facture
  const lignesAvecMatch = invoiceData.lignes.map((ligne) => {
    const ingredient_id = matchIngredient(ligne.designation, ingredients)
    return { ...ligne, ingredient_id, matched: ingredient_id !== null }
  })

  // Trouver le fournisseur via nom extrait (best-effort)
  let fournisseurId: string | null = null
  if (invoiceData.fournisseur_nom) {
    const { data: fournisseurs } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('nom', `%${invoiceData.fournisseur_nom.slice(0, 8)}%`)
      .is('deleted_at', null)
      .limit(1)
    fournisseurId = fournisseurs?.[0]?.id ?? null
  }

  // Mise à jour automatique mercuriale pour les lignes matchées avec fournisseur connu
  const autoUpdates: string[] = []
  if (fournisseurId) {
    for (const ligne of lignesAvecMatch) {
      if (ligne.ingredient_id && ligne.prix_unitaire_ht > 0) {
        // Désactiver l'ancien prix actif (mercuriale filtre via ingredient_id)
        await supabase
          .from('mercuriale')
          .update({ est_actif: false })
          .eq('ingredient_id', ligne.ingredient_id)
          .eq('est_actif', true)

        // Insérer nouveau prix (déclenche trigger cascade coûts — Task 2.5)
        await supabase.from('mercuriale').insert({
          ingredient_id: ligne.ingredient_id,
          fournisseur_id: fournisseurId,
          prix: ligne.prix_unitaire_ht,
          unite: ligne.unite || 'kg',
          est_actif: true,
          source: 'ocr',
          date_maj: new Date().toISOString(),
        })
        autoUpdates.push(ligne.designation)
      }
    }
  }

  return NextResponse.json({
    invoice: { ...invoiceData, lignes: lignesAvecMatch },
    auto_updated: autoUpdates,
    requires_manual: lignesAvecMatch.filter((l) => !l.matched).length,
  })
}
