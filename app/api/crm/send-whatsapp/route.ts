// Proxy CRM — envoie un message WhatsApp de prospection à un prospect
// Accessible aux users authentifiés (protégé par middleware Supabase, pas de INTERNAL_CRON_KEY)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'
import { sendProspectionMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prospect_id } = body as { prospect_id?: string }

    if (!prospect_id) {
      return NextResponse.json({ error: 'prospect_id manquant' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Récupère le prospect
    const { data: prospect, error: fetchError } = await supabase
      .from('prospects')
      .select('id, nom, telephone, ville, statut, whatsapp_sent_at')
      .eq('id', prospect_id)
      .single()

    if (fetchError || !prospect) {
      return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
    }

    // Validations métier
    if (!prospect.telephone) {
      return NextResponse.json({ error: 'Numéro de téléphone manquant' }, { status: 422 })
    }

    if (prospect.statut === 'dead') {
      return NextResponse.json(
        { error: 'Prospect marqué comme dead — envoi bloqué' },
        { status: 422 }
      )
    }

    if (prospect.whatsapp_sent_at) {
      return NextResponse.json(
        {
          error:
            'Message déjà envoyé le ' +
            new Date(prospect.whatsapp_sent_at).toLocaleDateString('fr-FR'),
        },
        { status: 422 }
      )
    }

    // Envoi WhatsApp
    const result = await sendProspectionMessage({
      telephone: prospect.telephone,
      nom_restaurant: prospect.nom,
      ville: prospect.ville ?? '',
      message_personnalise: '',
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Erreur envoi WhatsApp' }, { status: 502 })
    }

    // Mise à jour du statut en base
    const { error: updateError } = await prospectionTable(supabase, 'prospects')
      .update({
        statut: 'contacted',
        whatsapp_sent_at: new Date().toISOString(),
      })
      .eq('id', prospect_id)

    if (updateError) {
      console.error('[send-whatsapp] Envoi OK mais update échoué:', updateError)
      // On retourne quand même ok:true car le message est parti
    }

    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err) {
    console.error('[send-whatsapp] Erreur inattendue:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
