import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Vérification authorization stricte (service role key)
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey!
  )

  let payload: { ingredient_id: string; nouveau_prix: number }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { ingredient_id, nouveau_prix } = payload
  if (!ingredient_id || nouveau_prix == null) {
    return new Response('Missing ingredient_id or nouveau_prix', { status: 400 })
  }

  console.log(`[recalculate-costs] Recalcul pour ingrédient ${ingredient_id} à ${nouveau_prix}€/kg`)

  // Trouver tous les plats utilisant cet ingrédient
  const { data: lignes, error: lignesError } = await supabase
    .from('fiche_technique')
    .select('plat_id')
    .eq('ingredient_id', ingredient_id)

  if (lignesError) {
    console.error('[recalculate-costs] Erreur fiche_technique:', lignesError.message)
    return new Response(JSON.stringify({ error: lignesError.message }), { status: 500 })
  }

  if (!lignes?.length) {
    console.log(`[recalculate-costs] Aucune fiche technique pour ingrédient ${ingredient_id}`)
    return new Response(JSON.stringify({ updated: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const platIds = [...new Set(lignes.map((l) => l.plat_id as string))]
  let updatedCount = 0

  for (const platId of platIds) {
    // Récupérer toutes les lignes du plat avec le prix mercuriale actif
    const { data: allLignes, error: allLignesError } = await supabase
      .from('fiche_technique')
      .select(`
        id,
        grammage,
        unite,
        ingredient_id,
        mercuriale!inner(prix, unite, est_actif)
      `)
      .eq('plat_id', platId)
      .eq('mercuriale.est_actif', true)

    if (allLignesError || !allLignes) {
      console.error(`[recalculate-costs] Erreur lignes plat ${platId}:`, allLignesError?.message)
      continue
    }

    // Calculer le coût total : grammage(g) × prix(€/kg) / 1000
    let coutTotal = 0
    let allPriced = true

    for (const ligne of allLignes) {
      const merc = Array.isArray(ligne.mercuriale) ? ligne.mercuriale[0] : ligne.mercuriale

      if (!merc?.prix) {
        allPriced = false
        continue
      }

      // Convention: prix en €/kg, grammage en g
      const prixParG = merc.prix / 1000
      coutTotal += ligne.grammage * prixParG
    }

    // Si certains ingrédients n'ont pas de prix → coût null (pas d'erreur)
    const coutDeRevient: number | null =
      allPriced && coutTotal > 0 ? Math.round(coutTotal * 100) / 100 : null

    // UPDATE plats.cout_de_revient
    const { error: updateError } = await supabase
      .from('plats')
      .update({ cout_de_revient: coutDeRevient, updated_at: new Date().toISOString() })
      .eq('id', platId)

    if (updateError) {
      console.error(`[recalculate-costs] Erreur update plat ${platId}:`, updateError.message)
      continue
    }

    // Prochain numéro de version
    const { count } = await supabase
      .from('fiche_technique_versions')
      .select('*', { count: 'exact', head: true })
      .eq('plat_id', platId)

    const nextVersion = (count ?? 0) + 1

    await supabase.from('fiche_technique_versions').insert({
      plat_id: platId,
      version_number: nextVersion,
      ingredients_snapshot: {
        type: 'recalcul_prix',
        ingredient_id,
        nouveau_prix,
        cout_de_revient: coutDeRevient,
        lignes: allLignes,
      },
      cout_calcule: coutDeRevient,
      modifie_par: null, // recalcul système
    })

    updatedCount++
    console.log(`[recalculate-costs] Plat ${platId}: cout_de_revient=${coutDeRevient} (v${nextVersion})`)
  }

  console.log(`[recalculate-costs] ${updatedCount}/${platIds.length} plats mis à jour`)
  return new Response(JSON.stringify({ updated: updatedCount, total: platIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
