// Pipeline nurturing — Envoi des messages follow-up schedulés
// Cron : 0 10 * * 1-5 (lundi-vendredi 10h)

import { NextRequest } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'
import { sendProspectionMessage } from '@/lib/whatsapp'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Templates de follow-up (texte libre — envoyés dans session ouverte si réponse <24h)
// Sinon utilise le template Meta approuvé
const TEMPLATES: Record<string, string> = {
  followup_warm:
    "Bonjour, je reviens vers vous concernant Le Rush — l'app de gestion pour les restaurants. " +
    "Avez-vous eu le temps d'y réfléchir ? Je suis disponible pour 15 minutes si vous souhaitez une démo rapide. " +
    'Bonne journée ! Cyril',
  followup_cold:
    'Bonjour, je vous recontacte une dernière fois concernant Le Rush. ' +
    'Depuis notre dernier message, plusieurs restaurateurs ont réduit leurs pertes matière de 8% en moyenne. ' +
    'Si la gestion de vos coûts vous intéresse, répondez OUI. Sinon répondez STOP. Cyril — Le Rush',
}

interface ScheduledMessageRow {
  id: string
  prospect_id: string | null
  channel: 'whatsapp' | 'email'
  template_key: string | null
  personalization: unknown
  prospects:
    | {
        id: string
        nom: string
        telephone: string | null
        ville: string | null
        statut: string
        unsubscribed_at: string | null
      }
    | Array<{
        id: string
        nom: string
        telephone: string | null
        ville: string | null
        statut: string
        unsubscribed_at: string | null
      }>
    | null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let sent = 0
  let failed = 0

  try {
    // Récupérer tous les messages à envoyer maintenant
    const { data: rawMessages } = await supabase
      .from('scheduled_messages')
      .select(
        `
        id,
        prospect_id,
        channel,
        template_key,
        personalization,
        prospects (
          id, nom, telephone, ville, statut, unsubscribed_at
        )
      `
      )
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())
      .limit(50)

    const messages = (rawMessages ?? []) as unknown as ScheduledMessageRow[]

    if (messages.length === 0) {
      return Response.json({ sent: 0, message: 'Aucun message à envoyer' })
    }

    console.log(`[nurturing-sender] ${messages.length} messages à envoyer`)

    for (const msg of messages) {
      const prospect = Array.isArray(msg.prospects) ? msg.prospects[0] : msg.prospects

      // Vérifications de sécurité
      if (!prospect || prospect.unsubscribed_at || prospect.statut === 'dead') {
        await prospectionTable(supabase, 'scheduled_messages')
          .update({ status: 'failed', error_message: 'Prospect désinscrit ou dead' })
          .eq('id', msg.id)
        continue
      }

      if (!prospect.telephone) {
        await prospectionTable(supabase, 'scheduled_messages')
          .update({ status: 'failed', error_message: 'Pas de téléphone' })
          .eq('id', msg.id)
        continue
      }

      try {
        let success = false

        if (msg.channel === 'whatsapp') {
          // Pour les follow-ups, on utilise le template Meta (cold) ou texte libre (warm, si session ouverte)
          const result = await sendProspectionMessage({
            telephone: prospect.telephone,
            nom_restaurant: prospect.nom,
            ville: prospect.ville ?? 'France',
            message_personnalise:
              TEMPLATES[msg.template_key ?? 'followup_warm'] ?? TEMPLATES.followup_warm,
          })
          success = result.success

          if (!success) {
            console.warn(`[nurturing-sender] Échec WhatsApp pour ${prospect.nom}: ${result.error}`)
          }
        }

        await prospectionTable(supabase, 'scheduled_messages')
          .update({
            status: success ? 'sent' : 'failed',
            sent_at: success ? new Date().toISOString() : null,
          })
          .eq('id', msg.id)

        if (success) {
          sent++
          console.log(`[nurturing-sender] ✓ ${prospect.nom} — template: ${msg.template_key}`)
        } else {
          failed++
        }
      } catch (err) {
        console.error(`[nurturing-sender] Exception pour ${prospect.nom}:`, (err as Error).message)
        await prospectionTable(supabase, 'scheduled_messages')
          .update({ status: 'failed', error_message: (err as Error).message })
          .eq('id', msg.id)
        failed++
      }

      // Petit délai entre envois
      await new Promise((r) => setTimeout(r, 2000))
    }

    await pingHeartbeat('nurturing-sender')

    console.log(`[nurturing-sender] Terminé — ${sent} envoyés, ${failed} échoués`)
    return Response.json({ sent, failed })
  } catch (error) {
    console.error('[nurturing-sender] Erreur critique:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
