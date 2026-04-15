import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface MatchSuggestion {
  designation: string // original OCR designation
  ingredient_id: string // matched restaurant_ingredient id
  ingredient_nom: string // matched ingredient name
  confidence: number // 0.0 – 1.0
}

const SYSTEM_PROMPT = `Tu es un expert en approvisionnement de restaurant français.
On te donne des désignations de produits telles qu'elles apparaissent sur des factures fournisseurs,
et une liste d'ingrédients utilisés dans la cuisine du restaurant.

Pour chaque désignation, trouve l'ingrédient correspondant dans la liste, en tenant compte :
- des variations de formulation ("Poitrine fumée tranchée 2kg" → "Poitrine fumée")
- des abréviations et codes fournisseurs
- des conditionnements (2kg, 5L, carton) à ignorer
- des variations orthographiques et majuscules

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown.
Format : [{"designation": "...", "ingredient_id": "...", "confidence": 0.9}, ...]

Si aucun ingrédient ne correspond (score < 0.5), omets l'entrée du tableau.`

export async function claudeMatchIngredients(
  designations: string[],
  ingredients: { id: string; nom: string }[],
  timeoutMs = 8000
): Promise<MatchSuggestion[]> {
  if (designations.length === 0 || ingredients.length === 0) return []

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
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Désignations fournisseur à matcher :
${JSON.stringify(designations)}

Ingrédients du restaurant (id + nom) :
${JSON.stringify(ingredients)}`,
          },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const raw = JSON.parse(text) as {
      designation: string
      ingredient_id: string
      confidence: number
    }[]

    // Enrich with ingredient_nom and validate ingredient_id exists
    const idToNom = new Map(ingredients.map((i) => [i.id, i.nom]))
    return raw
      .filter((r) => idToNom.has(r.ingredient_id) && r.confidence >= 0.5)
      .map((r) => ({
        designation: r.designation,
        ingredient_id: r.ingredient_id,
        ingredient_nom: idToNom.get(r.ingredient_id)!,
        confidence: r.confidence,
      }))
  } catch (error) {
    clearTimeout(timeoutId)

    if ((error as Error).name === 'AbortError') {
      console.warn('[ingredient-matcher] Timeout après', timeoutMs, 'ms — matching IA ignoré')
      return []
    }

    console.error('[ingredient-matcher] Erreur Claude:', error)
    return [] // Graceful degradation — caller falls back to manual review
  }
}
