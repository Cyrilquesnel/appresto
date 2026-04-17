// Pipeline A — Scraping Google Maps → Enrichissement Firecrawl → Scoring → CRM
// Cron : 0 2 * * 1 (lundi 2h du matin)

import { NextRequest } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'
import { searchRestaurants, VILLES_PRIORITAIRES } from '@/lib/prospection/outscraper'
import { enrichRestaurantWebsite } from '@/lib/prospection/firecrawl'
import { scoreProspect } from '@/lib/prospection/scorer'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 55
export const dynamic = 'force-dynamic'

// Nombre max de restaurants à traiter par exécution (respecte rate limits)
const BATCH_SIZE = 20

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let totalInserted = 0
  let totalSkipped = 0

  try {
    // Rotation des villes — on prend la prochaine ville non encore traitée cette semaine
    const ville = await getNextVille(supabase)
    console.log(`[google-maps-scrape] Ville cible : ${ville}`)

    const places = await searchRestaurants(ville, BATCH_SIZE)
    console.log(`[google-maps-scrape] ${places.length} restaurants trouvés pour "${ville}"`)

    for (const place of places) {
      try {
        // 1. Dédup — on ne retraite pas un place_id déjà connu
        const { data: existing } = await supabase
          .from('prospects')
          .select('id')
          .eq('google_place_id', place.place_id)
          .single()

        if (existing) {
          totalSkipped++
          continue
        }

        // 2. Enrichissement Firecrawl (best-effort, pas bloquant)
        let enrichissement
        if (place.site) {
          enrichissement = await enrichRestaurantWebsite(place.site)
        }

        // 3. Scoring Claude Haiku
        const scoreResult = await scoreProspect(place, enrichissement)

        // 4. Insertion en base
        const { error: insertError } = await prospectionTable(supabase, 'prospects').insert({
          google_place_id: place.place_id,
          nom: place.name,
          telephone: place.phone ? normalizePhone(place.phone) : null,
          email: enrichissement?.email_contact ?? null,
          website: place.site ?? null,
          adresse: {
            full: place.full_address,
            lat: place.latitude,
            lng: place.longitude,
          },
          ville: place.city ?? extractVille(ville),
          code_postal: place.postal_code ?? null,
          score: scoreResult.score,
          score_breakdown: scoreResult.breakdown,
          rating: place.rating ?? null,
          reviews_count: place.reviews ?? null,
          menu_snippet: enrichissement?.menu_snippet ?? null,
          type_cuisine: enrichissement?.type_cuisine ?? null,
          statut: 'new',
          source: 'google_maps',
        })

        if (insertError) {
          console.warn(`[google-maps-scrape] Insert error pour ${place.name}:`, insertError.message)
        } else {
          totalInserted++
          console.log(
            `[google-maps-scrape] ✓ ${place.name} (${place.city}) — score ${scoreResult.score}`
          )
        }
      } catch (err) {
        console.warn(`[google-maps-scrape] Erreur pour ${place.name}:`, (err as Error).message)
      }
    }

    await pingHeartbeat('google-maps-scrape')

    console.log(`[google-maps-scrape] Terminé — ${totalInserted} insérés, ${totalSkipped} doublons`)
    return Response.json({ inserted: totalInserted, skipped: totalSkipped, ville })
  } catch (error) {
    console.error('[google-maps-scrape] Erreur critique:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Rotation des villes : sélectionne la prochaine ville pas encore traitée cette semaine.
 * Repart au début quand toutes les villes ont été faites.
 */
async function getNextVille(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  // Récupère les villes déjà scrapées dans les 7 derniers jours
  const { data: recentProspects } = await supabase
    .from('prospects')
    .select('ville')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const villesTraitees = new Set(
    ((recentProspects ?? []) as unknown as { ville: string | null }[])
      .map((p) => p.ville?.toLowerCase())
      .filter(Boolean)
  )

  for (const query of VILLES_PRIORITAIRES) {
    const ville = extractVille(query)
    if (!villesTraitees.has(ville.toLowerCase())) {
      return query
    }
  }

  // Toutes les villes ont été traitées — repartir de la première
  return VILLES_PRIORITAIRES[0]
}

function extractVille(query: string): string {
  return query.replace('restaurants ', '').trim()
}

/** Normalise un numéro de téléphone au format international sans + */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    return '33' + digits.slice(1)
  }
  if (digits.startsWith('33')) return digits
  return digits
}
