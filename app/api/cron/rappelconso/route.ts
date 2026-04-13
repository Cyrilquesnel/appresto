import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRecentRappels, matchRappelWithIngredients, type RappelConsoRecord } from '@/lib/rappelconso'
import { sendRappelAlert } from '@/lib/push-notifications'
import type { PushSubscription } from 'web-push'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  let totalProcessed = 0
  let totalAlerts = 0

  try {
    const rappels = await fetchRecentRappels(100)
    console.log(`[rappelconso] ${rappels.length} rappels récupérés`)

    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id')

    for (const restaurant of (restaurants ?? [])) {
      const { data: ingredients } = await supabase
        .from('restaurant_ingredients')
        .select('id, nom')
        .eq('restaurant_id', restaurant.id)

      if (!ingredients || ingredients.length === 0) continue

      const ingredientsList = ingredients as unknown as { id: string; nom: string }[]
      for (const rappel of rappels) {
        const match = matchRappelWithIngredients(rappel, ingredientsList)
        if (!match) continue

        const { data: existingAlert } = await supabase
          .from('rappel_alerts')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('rappelconso_id', rappel.rappelguid)
          .single()

        if (existingAlert) continue

        await supabase
          .from('rappel_alerts')
          .insert({
            restaurant_id: restaurant.id,
            rappelconso_id: rappel.rappelguid,
            ingredient_id: match.ingredient_id,
            nom_produit: rappel.nom_produit_rappele,
            nom_marque: rappel.nom_marque_produit,
            motif: rappel.motif_rappel,
            risques: rappel.risques_pour_le_consommateur,
            date_rappel: rappel.date_debut_fev,
            lien_info: rappel.lien_vers_information_complementaire ?? null,
            traite: false,
          })

        totalAlerts++
        await notifyRestaurant(restaurant.id, rappel, match.nom)
      }

      totalProcessed++
    }

    if (process.env.BETTERUPTIME_HEARTBEAT_URL) {
      await fetch(process.env.BETTERUPTIME_HEARTBEAT_URL).catch(() => {})
    }

    console.log(`[rappelconso] ${totalProcessed} restaurants, ${totalAlerts} alertes`)
    return Response.json({ processed: totalProcessed, alerts: totalAlerts })
  } catch (error) {
    console.error('[rappelconso] Erreur:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

async function notifyRestaurant(
  restaurantId: string,
  rappel: RappelConsoRecord,
  ingredientNom: string,
): Promise<void> {
  const supabase = createClient()
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('restaurant_id', restaurantId)
    .single()

  if (sub) {
    try {
      await sendRappelAlert(
        sub.subscription as unknown as PushSubscription,
        rappel.nom_produit_rappele,
        ingredientNom,
      )
      console.log(`[rappelconso] Push envoyé — restaurant ${restaurantId}: ${ingredientNom}`)
    } catch (err) {
      console.error(`[rappelconso] Push failed — restaurant ${restaurantId}:`, err)
    }
  } else {
    console.log(`[rappelconso] Pas de subscription push — restaurant ${restaurantId}: ${ingredientNom}`)
  }
}
