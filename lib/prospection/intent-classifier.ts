// Classification d'intention des réponses WhatsApp entrantes
// Même pattern Claude Haiku + prompt caching

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Intent = 'hot' | 'warm' | 'cold' | 'unsubscribe'

export interface IntentResult {
  intent: Intent
  confidence: number // 0-1
  next_action: string
  summary: string
}

const SYSTEM_PROMPT = `Tu es l'agent de qualification de Le Rush, une app SaaS pour restaurateurs indépendants français.

Tu reçois un message WhatsApp d'un restaurateur en réponse à un message de prospection.

Classifie l'intention parmi :
- "hot" : intérêt clair, veut une démo ou plus d'infos (ex: "oui intéressé", "appelez-moi", "comment ça marche ?", "on peut se voir ?")
- "warm" : intérêt partiel ou questions (ex: "c'est quoi exactement ?", "quel est le prix ?", "peut-être plus tard")
- "cold" : pas d'intérêt actuellement mais poli (ex: "merci mais pas maintenant", "j'ai déjà un système", "pas le temps")
- "unsubscribe" : refus explicite, ne plus contacter (ex: "stop", "ne me contactez plus", "supprimez mon numéro", "pas intéressé du tout", "arrêtez")

Détermine le "next_action" :
- hot → "send_calendly" (envoyer lien de prise de RDV)
- warm → "followup_j3" (relance dans 3 jours)
- cold → "followup_j14" (relance dans 14 jours avec angle différent)
- unsubscribe → "block" (ne plus jamais contacter)

Réponds UNIQUEMENT avec un JSON valide :
{
  "intent": "hot",
  "confidence": 0.92,
  "next_action": "send_calendly",
  "summary": "Restaurateur intéressé, demande comment ça marche"
}`

export async function classifyIntent(
  message: string,
  historique?: string[]
): Promise<IntentResult> {
  // Détection STOP avant tout appel API (RGPD critique)
  if (isStopMessage(message)) {
    return {
      intent: 'unsubscribe',
      confidence: 1.0,
      next_action: 'block',
      summary: 'STOP détecté — désinscription immédiate',
    }
  }

  const fallback: IntentResult = {
    intent: 'cold',
    confidence: 0.5,
    next_action: 'followup_j14',
    summary: 'Classification heuristique (Claude indisponible)',
  }

  try {
    const context = historique?.length
      ? `\n\nHistorique récent :\n${historique.slice(-3).join('\n')}`
      : ''

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
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
          content: `Message reçu : "${message}"${context}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.parse(text) as IntentResult
  } catch {
    return fallback
  }
}

// Détection STOP heuristique (RGPD — doit être 100% fiable)
function isStopMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim()
  const stopKeywords = [
    'stop',
    'arrêt',
    'arrêter',
    'arrêtez',
    'ne plus',
    'plus de message',
    'supprimer',
    'supprimez',
    'désabonner',
    'désinscrit',
    'pas intéressé',
    'ne me contactez plus',
    'ne pas contacter',
    'retirer',
    'retirez',
  ]
  return stopKeywords.some((k) => normalized.includes(k))
}
