// Client Outscraper — Google Maps scraping asynchrone
// L'API retourne un task_id → polling jusqu'à Success
// Docs: https://outscraper.com/api-documentation/

export interface OutscraperPlace {
  place_id: string
  name: string
  full_address: string
  city: string
  postal_code: string
  country_code: string
  phone: string | null
  site: string | null
  rating: number | null
  reviews: number | null
  type: string | null
  subtypes: string | null
  about: Record<string, unknown> | null
  working_hours: Record<string, string> | null
  latitude: number
  longitude: number
}

const BASE_URL = 'https://api.app.outscraper.com'
const API_KEY = process.env.OUTSCRAPER_API_KEY!

// Villes FR prioritaires — ordre d'attaque Phase 1
export const VILLES_PRIORITAIRES = [
  'restaurants Paris',
  'restaurants Lyon',
  'restaurants Marseille',
  'restaurants Bordeaux',
  'restaurants Nice',
  'restaurants Toulouse',
  'restaurants Nantes',
  'restaurants Strasbourg',
  'restaurants Lille',
  'restaurants Montpellier',
]

// Chaînes à exclure du ciblage (pas des indépendants)
const CHAINES_BLACKLIST = [
  'mcdonald',
  'burger king',
  'kfc',
  'subway',
  'quick',
  'five guys',
  'pizza hut',
  'domino',
  'little caesar',
  'papa john',
  'brioche dorée',
  'paul',
  'paul boulangerie',
  'hippopotamus',
  'courtepaille',
  'flunch',
  'casino',
  'leon',
  'leon de bruxelles',
  'sushishop',
  'sushi shop',
  'planet sushi',
  'buffalo grill',
  'buffalo steakhouse',
  'ibis',
  'novotel',
  'mercure',
  'pullman',
  'campanile',
  'kyriad',
  'popeyes',
  'taco bell',
  'chipotle',
]

export function isChaine(nom: string): boolean {
  const nomLower = nom.toLowerCase()
  return CHAINES_BLACKLIST.some((chaine) => nomLower.includes(chaine))
}

/**
 * Recherche des restaurants via Outscraper Google Maps API (async)
 * Lance la tâche puis poll jusqu'à Success (max 90s)
 */
export async function searchRestaurants(query: string, limit = 20): Promise<OutscraperPlace[]> {
  if (!API_KEY) {
    console.warn('[outscraper] OUTSCRAPER_API_KEY manquant')
    return []
  }

  // 1. Lancer la tâche
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    language: 'fr',
    fields:
      'place_id,name,full_address,city,postal_code,country_code,phone,site,rating,reviews,type,subtypes',
  })

  const startRes = await fetch(`${BASE_URL}/maps/search-v3?${params}`, {
    headers: { 'X-API-KEY': API_KEY },
  })

  if (!startRes.ok) {
    const err = await startRes.text()
    throw new Error(`[outscraper] API error ${startRes.status}: ${err}`)
  }

  const task = await startRes.json()

  // Résultats synchrones (si le plan le permet)
  if (Array.isArray(task)) {
    return filterResults(task)
  }
  if (task.data && Array.isArray(task.data)) {
    return filterResults(task.data.flat())
  }

  // 2. Tâche async — polling sur results_location
  const resultsUrl: string = task.results_location
  if (!resultsUrl) {
    console.warn('[outscraper] Pas de results_location dans la réponse:', JSON.stringify(task))
    return []
  }

  console.log(`[outscraper] Tâche ${task.id} en cours, polling...`)

  // Poll toutes les 5s pendant 90s max
  for (let attempt = 0; attempt < 18; attempt++) {
    await new Promise((r) => setTimeout(r, 5000))

    const pollRes = await fetch(resultsUrl, {
      headers: { 'X-API-KEY': API_KEY },
    })

    if (!pollRes.ok) continue

    const result = await pollRes.json()

    if (result.status === 'Success' || result.status === 'success') {
      const places: OutscraperPlace[] = Array.isArray(result.data) ? result.data.flat() : []
      console.log(`[outscraper] ${places.length} résultats bruts pour "${query}"`)
      return filterResults(places)
    }

    if (result.status === 'Failed' || result.status === 'failed') {
      throw new Error(`[outscraper] Tâche échouée: ${JSON.stringify(result)}`)
    }

    console.log(`[outscraper] Status: ${result.status}, attente...`)
  }

  throw new Error('[outscraper] Timeout après 90s')
}

function filterResults(places: OutscraperPlace[]): OutscraperPlace[] {
  return places.filter((p) => p.phone && p.phone.trim() !== '' && !isChaine(p.name))
}
