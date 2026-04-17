// Scoring des leads prospects via Claude Haiku
// Même pattern que lib/ai/claude-enrichment.ts (prompt caching)

import Anthropic from '@anthropic-ai/sdk'
import type { OutscraperPlace } from './outscraper'
import type { FirecrawlResult } from './firecrawl'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ScoreResult {
  score: number // 0-100
  breakdown: {
    independant: number // +25 si indépendant confirmé
    rating: number // +20 si rating >= 4.2 avec 50+ avis
    prix: number // +20 si prix moyen 18-45€
    taille: number // +15 si 50-200 couverts estimés
    presence_web: number // +15 si site pro (pas Tripadvisor/Google)
    data_complete: number // +5 si tel + email disponibles
  }
  reason: string
}

const SYSTEM_PROMPT = `Tu es un expert en qualification de leads B2B pour Le Rush, une app SaaS pour restaurateurs indépendants français.

Tu dois scorer un restaurant de 0 à 100 selon son potentiel à devenir client Le Rush.

Critères de scoring (total = 100 points) :
- Indépendant confirmé (pas une chaîne) : +25 pts
- Note Google ≥ 4.2 avec au moins 50 avis : +20 pts
- Prix moyen estimé 18-45€ (cible principale) : +20 pts
- Taille estimée 50-200 couverts : +15 pts
- Présence web professionnelle (site propre, pas juste TripAdvisor) : +15 pts
- Données complètes (téléphone + email disponibles) : +5 pts

Réponds UNIQUEMENT avec un JSON valide :
{
  "score": 75,
  "breakdown": { "independant": 25, "rating": 20, "prix": 15, "taille": 10, "presence_web": 5, "data_complete": 0 },
  "reason": "Brasserie indépendante bien notée, prix cible, site web pro mais email manquant"
}`

export async function scoreProspect(
  place: OutscraperPlace,
  enrichissement?: FirecrawlResult
): Promise<ScoreResult> {
  const fallback: ScoreResult = {
    score: computeHeuristicScore(place, enrichissement),
    breakdown: {
      independant: 20,
      rating: 10,
      prix: 10,
      taille: 5,
      presence_web: 5,
      data_complete: 0,
    },
    reason: 'Score heuristique (Claude indisponible)',
  }

  try {
    const input = {
      nom: place.name,
      ville: place.city,
      rating: place.rating,
      avis: place.reviews,
      telephone: place.phone ? 'oui' : 'non',
      site_web: place.site ?? null,
      type: place.type,
      menu_snippet: enrichissement?.menu_snippet ?? null,
      type_cuisine: enrichissement?.type_cuisine ?? null,
      couverts: enrichissement?.couverts_estimes ?? null,
      prix_moyen: enrichissement?.prix_moyen ?? null,
      email: enrichissement?.email_contact ? 'oui' : 'non',
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // Prompt caching — économise 90% des coûts
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Score ce restaurant : ${JSON.stringify(input)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.parse(text) as ScoreResult
  } catch (err) {
    console.warn('[scorer] Claude indisponible, score heuristique utilisé:', (err as Error).message)
    return fallback
  }
}

// Score heuristique de secours (sans Claude)
function computeHeuristicScore(place: OutscraperPlace, enrichissement?: FirecrawlResult): number {
  let score = 0
  score += 20 // Indépendant : déjà filtré en amont via isChaine()
  if ((place.rating ?? 0) >= 4.2 && (place.reviews ?? 0) >= 50) score += 20
  else if ((place.rating ?? 0) >= 3.8) score += 10
  if (
    enrichissement?.prix_moyen &&
    enrichissement.prix_moyen >= 18 &&
    enrichissement.prix_moyen <= 45
  )
    score += 20
  if (enrichissement?.couverts_estimes) {
    const c = enrichissement.couverts_estimes
    if (c >= 50 && c <= 200) score += 15
    else if (c >= 30) score += 8
  }
  if (place.site && !place.site.includes('tripadvisor') && !place.site.includes('google'))
    score += 15
  if (place.phone && enrichissement?.email_contact) score += 5
  return Math.min(score, 100)
}
