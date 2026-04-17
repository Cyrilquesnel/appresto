// Pipeline D — Génération contenu social media Onrush
// Cron : 0 6 * * 1 (lundi 6h)
// Génère 3 carousels/semaine (LinkedIn x2 + Instagram x1) via Gamma AI
// Pas de Claude nécessaire — Gamma génère le contenu visuel depuis les prompts
// Stocke en DB + email récap avec liens directs

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCarousel } from '@/lib/content/gamma'
import { Resend } from 'resend'
import { pingHeartbeat } from '@/lib/betteruptime'

// 300s pour laisser le temps aux 3 appels Gamma (~80s max chacun)
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type ContentType = 'tip' | 'feature' | 'social_proof' | 'engagement' | 'behind_scenes'
type Platform = 'instagram' | 'linkedin'

interface CarouselTask {
  platform: Platform
  content_type: ContentType
  prompt: string
  publish_date: string
}

// 7 thèmes en rotation — offset par numéro de semaine
const THEMES: Array<{ content_type: ContentType; platform: Platform; prompt: string }> = [
  {
    content_type: 'tip',
    platform: 'linkedin',
    prompt:
      'Carousel LinkedIn B2B pour restaurateurs indépendants français. Thème : 3 conseils concrets pour réduire le food cost de 5 à 10%. Ton direct, chiffres précis, exemples terrain. App Le Rush — gestion restaurant made in France.',
  },
  {
    content_type: 'tip',
    platform: 'instagram',
    prompt:
      'Carousel Instagram pour restaurateurs. Thème : gagner 2h par semaine sur la gestion administrative grâce au numérique. Accroche forte sur la 1ère slide, 3 tips pratiques, CTA final. Ton authentique, emojis dosés. App Le Rush.',
  },
  {
    content_type: 'feature',
    platform: 'linkedin',
    prompt:
      "Carousel LinkedIn : présentation de la fonctionnalité HACCP numérique de l'app Le Rush. Relevés de températures automatiques, alertes, conformité réglementaire garantie. Focus ROI et gain de temps pour les restaurateurs.",
  },
  {
    content_type: 'social_proof',
    platform: 'instagram',
    prompt:
      "Carousel Instagram : témoignage fictif d'un restaurateur français qui utilise Le Rush depuis 3 mois. Avant/après : paperasse manuelle → tout numérique. Résultats concrets : food cost maîtrisé, temps libéré, conformité HACCP. Style authentique.",
  },
  {
    content_type: 'engagement',
    platform: 'linkedin',
    prompt:
      'Carousel LinkedIn : sondage / question aux restaurateurs sur leurs plus grands défis quotidiens (food cost, HACCP, commandes fournisseurs, fiches techniques). Invite à partager leur expérience. CTA discussion.',
  },
  {
    content_type: 'feature',
    platform: 'instagram',
    prompt:
      "Carousel Instagram : présentation des fiches techniques digitales avec calcul automatique du food cost dans l'app Le Rush. 3 slides max, visuel épuré, chiffres impactants. Pour restaurateurs 30-200 couverts.",
  },
  {
    content_type: 'behind_scenes',
    platform: 'linkedin',
    prompt:
      "Carousel LinkedIn : coulisses du lancement d'une app SaaS restaurant en France. 3 étapes clés, learnings, vision. Ton fondateur authentique. App Onrush / Le Rush — solo founder, restaurateurs indépendants.",
  },
]

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getNextPublishDates(): string[] {
  const today = new Date()
  const dates: string[] = []
  for (const targetDay of [1, 3, 5]) {
    const d = new Date(today)
    const currentDay = d.getDay()
    let diff = targetDay - currentDay
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() + diff)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function buildWeeklyTasks(): CarouselTask[] {
  const dates = getNextPublishDates()
  const weekNumber = getWeekNumber(new Date())
  const offset = (weekNumber * 3) % THEMES.length

  return [
    { ...THEMES[offset % THEMES.length], publish_date: dates[0] },
    { ...THEMES[(offset + 1) % THEMES.length], publish_date: dates[1] },
    { ...THEMES[(offset + 2) % THEMES.length], publish_date: dates[2] },
  ]
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const adminEmail = process.env.ADMIN_EMAIL ?? 'cyril.quesnel@gmail.com'

  try {
    const tasks = buildWeeklyTasks()
    console.log('[content-calendar] Génération de', tasks.length, 'carousels via Gamma...')

    const results: Array<{ task: CarouselTask; gammaUrl: string | null }> = []

    for (const task of tasks) {
      console.log(`[content-calendar] Génération ${task.platform} (${task.content_type})...`)
      const gammaUrl = await generateCarousel(task.prompt)
      results.push({ task, gammaUrl })
    }

    const successful = results.filter((r) => r.gammaUrl !== null)
    if (successful.length === 0) {
      return Response.json({ error: 'Aucun carousel généré — voir logs Vercel' }, { status: 500 })
    }

    // Sauvegarder en base
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('content_calendar') as any).insert(
      results.map(({ task, gammaUrl }) => ({
        platform: task.platform,
        content_type: task.content_type,
        content_text: task.prompt,
        publish_date: task.publish_date,
        gamma_url: gammaUrl,
        status: 'draft',
      }))
    )

    if (insertError) {
      console.error('[content-calendar] Erreur insert:', insertError)
    }

    // Email récap
    await getResend().emails.send({
      from: 'Le Rush Content <noreply@lerush.app>',
      to: adminEmail,
      subject: `🎨 ${successful.length} carousels Onrush prêts — semaine du ${tasks[0].publish_date}`,
      html: buildEmailHtml(results),
    })

    await pingHeartbeat('content-calendar')

    console.log(
      `[content-calendar] ✓ ${successful.length}/${tasks.length} carousels + email envoyé`
    )
    return Response.json({
      generated: successful.length,
      total: tasks.length,
      carousels: results.map(({ task, gammaUrl }) => ({
        platform: task.platform,
        content_type: task.content_type,
        publish_date: task.publish_date,
        gamma_url: gammaUrl,
      })),
    })
  } catch (error) {
    console.error('[content-calendar] Erreur critique:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

function buildEmailHtml(results: Array<{ task: CarouselTask; gammaUrl: string | null }>): string {
  const platformIcon = (p: string) => (p === 'instagram' ? '📸' : '💼')
  const platformLabel = (p: string) => (p === 'instagram' ? 'Instagram' : 'LinkedIn')
  const typeLabel: Record<string, string> = {
    tip: 'Conseil',
    feature: 'Fonctionnalité',
    social_proof: 'Preuve sociale',
    engagement: 'Engagement',
    behind_scenes: 'Coulisses',
  }

  const firstDate = results[0]?.task.publish_date ?? ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937">
  <h1 style="font-size:20px;margin-bottom:4px">🎨 Carousels Onrush — Semaine du ${firstDate}</h1>
  <p style="color:#6b7280;margin-top:0;margin-bottom:24px">
    ${results.filter((r) => r.gammaUrl).length} carousels générés par Gamma · Ouvre dans Gamma, télécharge et publie via Metricool
  </p>

  ${results
    .map(
      ({ task, gammaUrl }) => `
  <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:18px">${platformIcon(task.platform)}</span>
      <strong style="font-size:15px">${platformLabel(task.platform)}</strong>
      <span style="background:#f3f4f6;color:#6b7280;font-size:12px;padding:2px 8px;border-radius:20px">${typeLabel[task.content_type] ?? task.content_type}</span>
      <span style="margin-left:auto;color:#9ca3af;font-size:12px">📅 ${formatDate(task.publish_date)}</span>
    </div>

    ${
      gammaUrl
        ? `<a href="${gammaUrl}" target="_blank"
           style="display:inline-flex;align-items:center;gap:6px;background:#6366f1;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">
           🎨 Ouvrir le carousel Gamma →
         </a>`
        : `<span style="font-size:13px;color:#ef4444">⚠️ Génération échouée — relancer le cron</span>`
    }
  </div>
  `
    )
    .join('')}

  <p style="margin-top:24px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px">
    Le Rush · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://lerush.app'}/admin/crm" style="color:#6b7280">Dashboard →</a>
  </p>
</body>
</html>`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
