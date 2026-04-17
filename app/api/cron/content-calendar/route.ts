// Pipeline D — Génération contenu social media Onrush
// Cron : 0 6 * * 1 (lundi 6h)
// Génère 3 posts/semaine (LinkedIn x2 + Instagram x1) via Claude Haiku
// Stocke en DB + email récap prêt-à-poster

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWeeklyPosts } from '@/lib/content/generator'
import { Resend } from 'resend'
import { pingHeartbeat } from '@/lib/betteruptime'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

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
    // 1. Générer les 3 posts via Claude Haiku
    console.log('[content-calendar] Génération des posts de la semaine...')
    const posts = await generateWeeklyPosts()
    console.log(`[content-calendar] ${posts.length} posts générés`)

    if (posts.length === 0) {
      return Response.json({ error: 'Aucun post généré' }, { status: 500 })
    }

    // 2. Sauvegarder en base
    const { error: insertError } = await supabase.from('content_calendar').insert(
      posts.map((p) => ({
        platform: p.platform,
        content_type: p.content_type,
        content_text: p.content_text,
        hashtags: p.hashtags,
        publish_date: p.publish_date,
        status: 'draft',
      }))
    )

    if (insertError) {
      console.error('[content-calendar] Erreur insert:', insertError)
    }

    // 3. Envoyer l'email récap
    await getResend().emails.send({
      from: 'Le Rush Content <noreply@lerush.app>',
      to: adminEmail,
      subject: `✍️ ${posts.length} posts Onrush prêts — semaine du ${posts[0]?.publish_date}`,
      html: buildEmailHtml(posts),
    })

    await pingHeartbeat('content-calendar')

    console.log(`[content-calendar] ✓ ${posts.length} posts générés + email envoyé`)
    return Response.json({
      generated: posts.length,
      posts: posts.map((p) => ({
        platform: p.platform,
        publish_date: p.publish_date,
        preview: p.content_text.slice(0, 60),
      })),
    })
  } catch (error) {
    console.error('[content-calendar] Erreur critique:', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

function buildEmailHtml(posts: Awaited<ReturnType<typeof generateWeeklyPosts>>): string {
  const platformIcon = (p: string) => (p === 'instagram' ? '📸' : '💼')
  const platformLabel = (p: string) => (p === 'instagram' ? 'Instagram' : 'LinkedIn')
  const typeLabel: Record<string, string> = {
    tip: 'Conseil',
    feature: 'Fonctionnalité',
    social_proof: 'Preuve sociale',
    engagement: 'Engagement',
    behind_scenes: 'Coulisses',
  }

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937">
  <h1 style="font-size:20px;margin-bottom:4px">✍️ Posts Onrush — Semaine du ${posts[0]?.publish_date}</h1>
  <p style="color:#6b7280;margin-top:0;margin-bottom:24px">
    ${posts.length} posts générés par Claude · Copie-colle dans Metricool ou Buffer
  </p>

  ${posts
    .map(
      (post, i) => `
  <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:18px">${platformIcon(post.platform)}</span>
      <strong style="font-size:15px">${platformLabel(post.platform)}</strong>
      <span style="background:#f3f4f6;color:#6b7280;font-size:12px;padding:2px 8px;border-radius:20px">${typeLabel[post.content_type] ?? post.content_type}</span>
      <span style="margin-left:auto;color:#9ca3af;font-size:12px">📅 ${formatDate(post.publish_date)}</span>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:14px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#374151">
${post.content_text}
    </div>

    ${
      post.hashtags.length > 0
        ? `
    <div style="margin-top:10px;font-size:13px;color:#6366f1">
      ${post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
    </div>`
        : ''
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
