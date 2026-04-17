// Pipeline B — WhatsApp Outreach automatisé
// Cron : 0 9 * * 1-5 (lundi-vendredi 9h00)
// Envoie 50 messages/jour aux leads scorés ≥ 60, avec délai aléatoire entre chaque

import { NextRequest } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'
import { sendProspectionMessage } from '@/lib/whatsapp'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface ProspectLead {
  id: string
  nom: string
  telephone: string | null
  ville: string | null
  score: number | null
}

const DAILY_LIMIT = 50
const SCORE_MIN = 60
// Délai entre messages : 30-90s (évite la détection spam par Meta)
const DELAY_MIN_MS = 30_000
const DELAY_MAX_MS = 90_000

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let sent = 0
  let failed = 0

  try {
    // 1. Vérifier combien de messages ont déjà été envoyés aujourd'hui
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: alreadySentToday } = await supabase
      .from('prospects')
      .select('id', { count: 'exact', head: true })
      .gte('whatsapp_sent_at', todayStart.toISOString())

    const remaining = DAILY_LIMIT - (alreadySentToday ?? 0)
    if (remaining <= 0) {
      console.log('[whatsapp-outreach] Limite journalière atteinte')
      return Response.json({ sent: 0, message: 'Limite journalière atteinte' })
    }

    // 2. Récupérer les leads prioritaires
    const { data: rawLeads } = await supabase
      .from('prospects')
      .select('id, nom, telephone, ville, score')
      .eq('statut', 'new')
      .gte('score', SCORE_MIN)
      .is('whatsapp_sent_at', null)
      .is('unsubscribed_at', null)
      .order('score', { ascending: false })
      .limit(remaining)

    const leads = (rawLeads ?? []) as unknown as ProspectLead[]

    if (leads.length === 0) {
      console.log('[whatsapp-outreach] Aucun lead disponible')
      return Response.json({ sent: 0, message: 'Aucun lead disponible' })
    }

    console.log(`[whatsapp-outreach] ${leads.length} leads à contacter`)

    // 3. Envoi avec délai aléatoire entre chaque message
    for (const lead of leads) {
      if (!lead.telephone) {
        console.log(`[whatsapp-outreach] Skip ${lead.nom} — pas de téléphone`)
        continue
      }

      try {
        const result = await sendProspectionMessage({
          telephone: lead.telephone,
          nom_restaurant: lead.nom,
          ville: lead.ville ?? 'France',
          message_personnalise: '', // Variables passées via template Meta
        })

        if (result.success) {
          await prospectionTable(supabase, 'prospects')
            .update({
              statut: 'contacted',
              whatsapp_sent_at: new Date().toISOString(),
              whatsapp_message_id: result.messageId ?? null,
            })
            .eq('id', lead.id)

          sent++
          console.log(`[whatsapp-outreach] ✓ ${lead.nom} (${lead.ville}) — score ${lead.score}`)
        } else {
          console.warn(`[whatsapp-outreach] ✗ ${lead.nom}: ${result.error}`)
          failed++

          // Marquer comme dead si erreur définitive (numéro invalide)
          if (result.error?.includes('131026') || result.error?.includes('invalid')) {
            await prospectionTable(supabase, 'prospects')
              .update({ statut: 'dead', notes: `Erreur WhatsApp: ${result.error}` })
              .eq('id', lead.id)
          }
        }
      } catch (err) {
        console.error(`[whatsapp-outreach] Exception pour ${lead.nom}:`, (err as Error).message)
        failed++
      }

      // Délai aléatoire entre messages (sauf pour le dernier)
      if (lead !== leads[leads.length - 1]) {
        const delay = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)
        await sleep(delay)
      }
    }

    await pingHeartbeat('whatsapp-outreach')

    console.log(`[whatsapp-outreach] Terminé — ${sent} envoyés, ${failed} échoués`)
    return Response.json({ sent, failed, remaining: remaining - sent })
  } catch (error) {
    console.error('[whatsapp-outreach] Erreur critique:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
