import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface EnrichedIngredient {
  allergenes_confirmes: string[]
  grammage_portion: number // en grammes
  kcal_par_100g: number
  unite_standard: string // 'g' | 'ml' | 'pièce'
  notes?: string
}

export type EnrichmentResult = Record<string, EnrichedIngredient>

const SYSTEM_PROMPT = `Tu es un expert culinaire et nutritionniste spécialisé dans la réglementation alimentaire française.
Pour chaque ingrédient donné, retourne en JSON :
- allergenes_confirmes: liste des codes allergènes parmi ['gluten','crustaces','oeufs','poisson','arachides','soja','lait','fruits_coque','celeri','moutarde','sesame','so2','lupin','mollusques'] (liste vide si aucun)
- grammage_portion: grammage typique en grammes pour une portion restaurant standard
- kcal_par_100g: calories pour 100g (estimation)
- unite_standard: 'g' pour solides, 'ml' pour liquides, 'pièce' pour unitaires
- notes: remarque culinaire ou sanitaire importante (optionnel)

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.`

export async function enrichIngredients(
  ingredientNames: string[],
  timeoutMs = 10000
): Promise<EnrichmentResult> {
  if (ingredientNames.length === 0) return {}

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            // Cache le system prompt pour économiser les tokens (prompt caching)
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Enrichis ces ingrédients: ${JSON.stringify(ingredientNames)}\n\nRéponds avec un objet JSON où chaque clé est le nom de l'ingrédient.`,
          },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.parse(text) as EnrichmentResult
  } catch (error) {
    clearTimeout(timeoutId)

    if ((error as Error).name === 'AbortError') {
      console.warn('[claude-enrichment] Timeout après', timeoutMs, 'ms — enrichissement ignoré')
      return {}
    }

    console.error('[claude-enrichment] Erreur:', error)
    return {} // Dégradé gracieux — pipeline continue sans enrichissement
  }
}

/**
 * Détermine si l'enrichissement Claude est nécessaire.
 * Appelé uniquement si confiance_globale < 0.65 ou si des ingrédients individuels ont confiance < 0.65.
 */
export function shouldEnrich(confianceGlobale: number, ingredientsConfiance: number[]): boolean {
  if (confianceGlobale < 0.55) return true
  return ingredientsConfiance.some((c) => c < 0.55)
}
