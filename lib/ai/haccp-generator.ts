import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface HACCPPointCritique {
  plat_id: string | null
  plat_nom?: string
  danger: string
  etape_critique: string
  ccp_numero: string
  temperature_critique?: number
  limite_critique: string
  mesure_surveillance: string
  action_corrective: string
  verification: string
}

const SYSTEM_PROMPT = `Tu es un consultant HACCP certifié, expert en réglementation alimentaire française (règlement CE 852/2004, arrêtés du 21 décembre 2009).

Pour chaque plat décrit, identifie:
1. Les dangers biologiques (bactéries, virus, parasites), chimiques et physiques
2. Les Points de Contrôle Critiques (CCP) selon l'arbre de décision HACCP
3. Les limites critiques (températures, durées) selon la réglementation française
4. Les mesures de surveillance et actions correctives

Réponds avec un tableau JSON de points critiques. Pour la volaille et viande hachée: 74°C minimum. Pour le porc: 63°C. Pour les produits laitiers non pasteurisés: surveiller chaîne du froid. Pour la liaison froide: < 4°C en 2h.`

export async function generateHACCPPlan(
  plats: Array<{
    id: string
    nom: string
    ingredients: Array<{ nom: string; allergenes: string[] }>
    type_plat?: string | null
  }>
): Promise<HACCPPointCritique[]> {
  const platsSummary = plats.map(p => ({
    nom: p.nom,
    type: p.type_plat,
    ingredients: p.ingredients.map(i => i.nom).join(', '),
    allergenes: Array.from(new Set(p.ingredients.flatMap(i => i.allergenes))),
  }))

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
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
        content: `Génère le plan HACCP pour ce restaurant avec ces plats:

${JSON.stringify(platsSummary, null, 2)}

Retourne un tableau JSON d'objets avec ces champs:
- plat_nom: nom du plat concerné (ou "Général" si point commun à tous)
- danger: description du danger
- etape_critique: étape du process à risque
- ccp_numero: ex "CCP-1"
- temperature_critique: en degrés Celsius (null si non applicable)
- limite_critique: description précise
- mesure_surveillance: comment surveiller
- action_corrective: que faire si limite dépassée
- verification: comment vérifier le système

Génère UNIQUEMENT le JSON, sans markdown, sans explication.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const points = JSON.parse(text) as Array<Record<string, unknown>>
    return points.map((p, i) => ({
      plat_id: plats.find(pl => pl.nom === p.plat_nom)?.id ?? null,
      plat_nom: p.plat_nom as string | undefined,
      danger: p.danger as string,
      etape_critique: p.etape_critique as string,
      ccp_numero: (p.ccp_numero as string) ?? `CCP-${i + 1}`,
      temperature_critique: p.temperature_critique as number | undefined,
      limite_critique: p.limite_critique as string,
      mesure_surveillance: p.mesure_surveillance as string,
      action_corrective: p.action_corrective as string,
      verification: p.verification as string,
    }))
  } catch {
    throw new Error('Erreur parsing réponse Claude HACCP')
  }
}
