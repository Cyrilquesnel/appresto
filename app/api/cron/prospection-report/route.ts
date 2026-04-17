// Rapport hebdomadaire de prospection — envoyé par email chaque lundi 7h
// Cron : 0 7 * * 1

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

interface WeeklyStats {
  week: string
  total_leads: number
  contacts_sent: number
  replies: number
  reply_rate_pct: number
  demos_booked: number
  conversions: number
  hot_leads: number
  unsubscribes: number
  avg_lead_score: number
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const adminEmail = process.env.ADMIN_EMAIL ?? 'cyril.quesnel@gmail.com'

  try {
    // 1. Stats semaine en cours et semaine précédente
    const { data: stats } = await supabase.from('prospection_weekly_stats').select('*').limit(2)

    const current = stats?.[0] as WeeklyStats | undefined
    const previous = stats?.[1] as WeeklyStats | undefined

    // 2. Top 5 leads chauds
    const { data: hotLeads } = await supabase
      .from('prospects')
      .select('nom, ville, last_reply_text, last_reply_at, score')
      .eq('intent', 'hot')
      .order('last_reply_at', { ascending: false })
      .limit(5)

    // 3. Pipeline snapshot
    const { data: pipelineRaw } = await supabase.from('prospects').select('statut')
    const pipeline = (() => {
      const counts: Record<string, number> = {}
      for (const p of (pipelineRaw ?? []) as unknown as { statut: string }[]) {
        counts[p.statut] = (counts[p.statut] ?? 0) + 1
      }
      return counts
    })()

    // 4. Envoyer l'email HTML
    await getResend().emails.send({
      from: 'Le Rush CRM <noreply@lerush.app>',
      to: adminEmail,
      subject: `📊 Prospection hebdo — ${current?.contacts_sent ?? 0} contacts, ${current?.hot_leads ?? 0} leads chauds`,
      html: buildEmailHtml(current, previous, hotLeads ?? [], pipeline),
    })

    await pingHeartbeat('prospection-report')

    console.log(`[prospection-report] Rapport envoyé → ${adminEmail}`)
    return Response.json({ sent: true })
  } catch (error) {
    console.error('[prospection-report] Erreur:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

function buildEmailHtml(
  current: WeeklyStats | undefined,
  previous: WeeklyStats | undefined,
  hotLeads: {
    nom: string
    ville: string | null
    last_reply_text: string | null
    score: number | null
  }[],
  pipeline: Record<string, number>
): string {
  const delta = (curr?: number, prev?: number) => {
    if (curr == null || prev == null) return ''
    const d = curr - prev
    return d > 0
      ? `<span style="color:#16a34a">+${d}</span>`
      : d < 0
        ? `<span style="color:#dc2626">${d}</span>`
        : '='
  }

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <h1 style="font-size:20px;margin-bottom:4px">📊 Rapport Prospection Hebdo</h1>
  <p style="color:#6b7280;margin-top:0">Le Rush — ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <tr style="background:#f9fafb">
      <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Métrique</th>
      <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280">Cette semaine</th>
      <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280">vs S-1</th>
    </tr>
    <tr style="border-top:1px solid #e5e7eb">
      <td style="padding:10px 12px">Messages envoyés</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">${current?.contacts_sent ?? 0}</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.contacts_sent, previous?.contacts_sent)}</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb;background:#f9fafb">
      <td style="padding:10px 12px">Réponses</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">${current?.replies ?? 0}</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.replies, previous?.replies)}</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb">
      <td style="padding:10px 12px">Taux de réponse</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">${current?.reply_rate_pct ?? 0}%</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.reply_rate_pct, previous?.reply_rate_pct)}%</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb;background:#f9fafb">
      <td style="padding:10px 12px">🔥 Leads chauds</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600;color:#dc2626">${current?.hot_leads ?? 0}</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.hot_leads, previous?.hot_leads)}</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb">
      <td style="padding:10px 12px">Démos bookées</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">${current?.demos_booked ?? 0}</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.demos_booked, previous?.demos_booked)}</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb;background:#f9fafb">
      <td style="padding:10px 12px">Conversions (clients)</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600;color:#16a34a">${current?.conversions ?? 0}</td>
      <td style="padding:10px 12px;text-align:right">${delta(current?.conversions, previous?.conversions)}</td>
    </tr>
  </table>

  ${
    hotLeads.length > 0
      ? `
  <h2 style="font-size:16px;margin-top:32px">🔥 Leads chauds à suivre</h2>
  ${hotLeads
    .map(
      (l) => `
  <div style="border:1px solid #fca5a5;border-radius:8px;padding:12px;margin:8px 0;background:#fef2f2">
    <strong>${l.nom}</strong>${l.ville ? ` — ${l.ville}` : ''}<br/>
    <span style="color:#6b7280;font-size:13px">"${l.last_reply_text?.slice(0, 100) ?? '...'}"</span>
  </div>`
    )
    .join('')}
  `
      : ''
  }

  <h2 style="font-size:16px;margin-top:32px">📋 Pipeline total</h2>
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    ${Object.entries(pipeline)
      .map(
        ([statut, count]) => `
    <div style="background:#f3f4f6;border-radius:6px;padding:8px 16px;text-align:center">
      <div style="font-size:20px;font-weight:700">${count}</div>
      <div style="font-size:12px;color:#6b7280">${statut}</div>
    </div>`
      )
      .join('')}
  </div>

  <p style="margin-top:32px;font-size:12px;color:#9ca3af">
    Le Rush CRM · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://lerush.app'}/admin/crm" style="color:#6b7280">Voir le CRM →</a>
  </p>
</body>
</html>`
}
