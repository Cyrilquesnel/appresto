// Pipeline F — Webhook WhatsApp entrant
// Réception des réponses prospects + classification d'intention + routing
//
// Meta envoie 2 types de requêtes sur ce webhook :
//   GET  → Vérification du webhook lors du setup (hub.verify_token)
//   POST → Nouveau message entrant

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { classifyIntent } from '@/lib/prospection/intent-classifier'
import { sendProspectionReply } from '@/lib/whatsapp'
import { sendPushNotification } from '@/lib/push-notifications'
import type { PushSubscription } from 'web-push'

export const dynamic = 'force-dynamic'

const CALENDLY_URL = process.env.CALENDLY_URL ?? 'https://calendly.com/lerush/demo'

// ─── GET : Vérification webhook Meta ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[whatsapp-webhook] Vérification réussie')
    return new Response(challenge, { status: 200 })
  }

  return Response.json({ error: 'Forbidden' }, { status: 403 })
}

// ─── POST : Message entrant ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Valider la signature Meta (sécurité)
    // En production, vérifier le header x-hub-signature-256
    // Pour l'instant on vérifie juste la structure du payload

    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages) {
      // Pas un message (peut être un status update de livraison) — ignorer
      return Response.json({ ok: true })
    }

    const message = value.messages[0]
    const fromPhone = message?.from // Ex: "33612345678"
    const messageText = message?.text?.body ?? message?.button?.text ?? ''
    void message?.id // réservé pour logging futur

    if (!fromPhone || !messageText) {
      return Response.json({ ok: true })
    }

    console.log(`[whatsapp-webhook] Message de ${fromPhone}: "${messageText.slice(0, 50)}"`)

    const supabase = createServiceClient()

    // 1. Trouver le prospect correspondant
    const { data: prospect } = await supabase
      .from('prospects')
      .select('id, nom, ville, statut, unsubscribed_at')
      .or(`telephone.eq.${fromPhone},telephone.eq.0${fromPhone.slice(2)}`)
      .single()

    if (!prospect) {
      console.log(`[whatsapp-webhook] Prospect inconnu pour ${fromPhone}`)
      return Response.json({ ok: true })
    }

    // 2. Ignorer si déjà désinscrit
    if (prospect.unsubscribed_at) {
      console.log(`[whatsapp-webhook] Prospect ${prospect.nom} désinscrit — message ignoré`)
      return Response.json({ ok: true })
    }

    // 3. Classifier l'intention via Claude Haiku
    const intentResult = await classifyIntent(messageText)
    console.log(
      `[whatsapp-webhook] ${prospect.nom} → intent: ${intentResult.intent} (${Math.round(intentResult.confidence * 100)}%)`
    )

    // 4. Mettre à jour le prospect
    await supabase
      .from('prospects')
      .update({
        last_reply_at: new Date().toISOString(),
        last_reply_text: messageText.slice(0, 500),
        intent: intentResult.intent,
        intent_confidence: intentResult.confidence,
        statut:
          intentResult.intent === 'unsubscribe'
            ? 'dead'
            : intentResult.intent === 'hot'
              ? 'demo'
              : 'replied',
        unsubscribed_at: intentResult.intent === 'unsubscribe' ? new Date().toISOString() : null,
      })
      .eq('id', prospect.id)

    // 5. Routing selon l'intention
    switch (intentResult.intent) {
      case 'hot':
        await handleHotLead(prospect, fromPhone, supabase)
        break

      case 'warm':
        await scheduleFollowUp(prospect.id, fromPhone, 'followup_warm', 3, supabase)
        break

      case 'cold':
        await scheduleFollowUp(prospect.id, fromPhone, 'followup_cold', 14, supabase)
        break

      case 'unsubscribe':
        // RGPD : confirmer la désinscription
        await sendProspectionReply(
          fromPhone,
          'Bien reçu, vous ne recevrez plus de messages de notre part. Bonne continuation !'
        )
        console.log(`[whatsapp-webhook] STOP traité — ${prospect.nom} désinscrit`)
        break
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[whatsapp-webhook] Erreur:', error)
    // Toujours retourner 200 à Meta sinon il renvoie indéfiniment
    return Response.json({ ok: true })
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleHotLead(
  prospect: { id: string; nom: string; ville: string | null },
  phone: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  // 1. Envoyer le lien Calendly immédiatement
  await sendProspectionReply(
    phone,
    `Super ! Voici le lien pour réserver 20 minutes avec moi :\n${CALENDLY_URL}\n\nÀ très vite, Cyril — Le Rush 🚀`
  )

  // 2. Push notification iPhone (alerte immédiate)
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('restaurant_id', process.env.ADMIN_RESTAURANT_ID ?? '')
    .single()

  if (sub?.subscription) {
    try {
      await sendPushNotification(sub.subscription as unknown as PushSubscription, {
        title: '🔥 Lead chaud !',
        body: `${prospect.nom}${prospect.ville ? ` (${prospect.ville})` : ''} veut une démo Le Rush`,
        data: { url: `/admin/crm`, type: 'hot_lead' },
      })
    } catch (err) {
      console.warn('[whatsapp-webhook] Push notification échouée:', (err as Error).message)
    }
  }

  console.log(`[whatsapp-webhook] 🔥 Lead HOT — ${prospect.nom} — Calendly envoyé`)
}

async function scheduleFollowUp(
  prospectId: string,
  phone: string,
  templateKey: string,
  daysDelay: number,
  supabase: ReturnType<typeof createServiceClient>
) {
  const sendAt = new Date()
  sendAt.setDate(sendAt.getDate() + daysDelay)
  // Envoyer à 10h le jour J
  sendAt.setHours(10, 0, 0, 0)

  await supabase.from('scheduled_messages').insert({
    prospect_id: prospectId,
    channel: 'whatsapp',
    send_at: sendAt.toISOString(),
    template_key: templateKey,
    personalization: { phone },
    status: 'pending',
  })

  console.log(`[whatsapp-webhook] Follow-up J+${daysDelay} schedulé pour prospect ${prospectId}`)
}
