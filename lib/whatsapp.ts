const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

// ─── PROSPECTION B2B ─────────────────────────────────────────────────────────

export interface ProspectionMessageData {
  telephone: string // Format international sans + : "33612345678"
  nom_restaurant: string
  ville: string
  message_personnalise: string // Généré par CronCreate agent ou scorer
}

/**
 * Envoie un message de prospection froide via template Meta approuvé.
 *
 * CRITIQUE : Le cold outreach WhatsApp nécessite un template approuvé par Meta.
 * Les messages hors-session (>24h sans contact préalable) ne peuvent PAS être
 * du texte libre — Meta les bloque. Le template doit être soumis et approuvé
 * dans le Meta Business Manager avant utilisation.
 *
 * Template name : "lerush_prospection_v1"
 * Variables : {{1}} = nom_restaurant, {{2}} = ville
 *
 * Pour soumettre le template :
 * Meta Business Manager → WhatsApp → Message Templates → Create Template
 * Catégorie : MARKETING
 * Corps :
 *   "Bonjour, j'ai vu {{1}} à {{2}} sur Google Maps et je me permets ce message.
 *    Je suis Cyril, 20 ans de restauration. J'ai créé Le Rush — l'app mobile
 *    pour gérer fiches techniques, coûts et HACCP sans prise de tête.
 *    Ça vous intéresse de voir ça en 15 min ? Répondez OUI.
 *    Répondez STOP pour ne plus recevoir de messages."
 */
export async function sendProspectionMessage(
  data: ProspectionMessageData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phone = data.telephone.replace(/\D/g, '')

  if (!phone || phone.length < 10) {
    return { success: false, error: 'Numéro de téléphone invalide' }
  }

  const templateName = process.env.WHATSAPP_PROSPECTION_TEMPLATE ?? 'lerush_prospection_v1'

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: data.nom_restaurant },
                { type: 'text', text: data.ville },
              ],
            },
          ],
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      const errMsg = err?.error?.message ?? JSON.stringify(err)
      console.error(`[whatsapp-prospection] Erreur envoi → ${phone}:`, errMsg)
      return { success: false, error: errMsg }
    }

    const result = await response.json()
    return { success: true, messageId: result.messages?.[0]?.id }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Envoie un message de suivi libre (dans une session ouverte — réponse reçue < 24h)
 * Utilisé pour répondre aux leads HOT ou envoyer le lien Calendly
 */
export async function sendProspectionReply(
  telephone: string,
  message: string
): Promise<{ success: boolean; messageId?: string }> {
  const phone = telephone.replace(/\D/g, '')

  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        body: message,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`WhatsApp reply error: ${JSON.stringify(err)}`)
  }

  const result = await response.json()
  return { success: true, messageId: result.messages?.[0]?.id }
}

export interface BonLigneData {
  nom_produit: string
  quantite: number
  unite: string
  prix_unitaire?: number
}

export interface BonDeCommandeData {
  id: string
  fournisseur: { nom: string; contact_whatsapp?: string | null; contact_email?: string | null }
  date_livraison_souhaitee?: string | null
  lignes: BonLigneData[]
  total_ht: number
  notes?: string | null
  restaurant_nom: string
}

export function formatBonMessage(bon: BonDeCommandeData): string {
  const dateLivraison = bon.date_livraison_souhaitee
    ? `\nLivraison souhaitée: ${new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}`
    : ''

  const lignesText = bon.lignes
    .map((l) => {
      const total = l.prix_unitaire ? ` (${(l.quantite * l.prix_unitaire).toFixed(2)} €)` : ''
      return `• ${l.nom_produit}: ${l.quantite} ${l.unite}${total}`
    })
    .join('\n')

  const notes = bon.notes ? `\n\nNotes: ${bon.notes}` : ''

  return `*Bon de commande — ${bon.restaurant_nom}*${dateLivraison}

${lignesText}

*Total HT: ${bon.total_ht.toFixed(2)} €*${notes}

_Généré via Le Rush_`
}

export async function sendBonDeCommande(
  bon: BonDeCommandeData
): Promise<{ success: boolean; messageId?: string }> {
  if (!bon.fournisseur.contact_whatsapp) {
    throw new Error('Numéro WhatsApp du fournisseur manquant')
  }

  const message = formatBonMessage(bon)
  const phone = bon.fournisseur.contact_whatsapp.replace(/\D/g, '')

  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return { success: true, messageId: data.messages?.[0]?.id }
}
