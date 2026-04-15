import { Resend } from 'resend'
import type { BonDeCommandeData } from '@/lib/whatsapp'

const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Beta Daily Report ────────────────────────────────────────────────────────

export interface BetaUserStats {
  restaurant_id: string
  restaurant_nom: string
  restaurant_created_at: string
  owner_id: string
  email: string
  sessions_count: number
  avg_session_min: number
  total_events_count: number
  feature_counts: Record<string, number>
  error_count: number
}

const FEATURE_LABELS: Record<string, string> = {
  dish_photo_analyzed: 'Analyse photo IA',
  fiche_technique_saved: 'Fiche technique',
  bon_commande_generated: 'Bon de commande',
  temperature_logged: 'Relevé température',
  ddpp_export_generated: 'Export DDPP',
  onboarding_completed: 'Onboarding terminé',
  invoice_ocr_processed: 'OCR facture',
}

export async function sendBetaDailyReport(
  users: BetaUserStats[],
  adminEmail: string
): Promise<void> {
  const now = new Date()
  const dateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const totalUsers = users.length
  const activeYesterday = users.filter((u) => u.sessions_count > 0 || u.total_events_count > 0)
  const totalSessions = users.reduce((s, u) => s + u.sessions_count, 0)
  const totalErrors = users.reduce((s, u) => s + u.error_count, 0)
  const avgDuration =
    activeYesterday.length > 0
      ? (activeYesterday.reduce((s, u) => s + u.avg_session_min, 0) / activeYesterday.length).toFixed(1)
      : '0'

  // Agrégat des features sur tous les users
  const featureTotals: Record<string, number> = {}
  const featureUsers: Record<string, number> = {}
  for (const u of users) {
    for (const [feat, cnt] of Object.entries(u.feature_counts)) {
      featureTotals[feat] = (featureTotals[feat] ?? 0) + cnt
      featureUsers[feat] = (featureUsers[feat] ?? 0) + 1
    }
  }

  // Nouveaux inscrits (créés dans les dernières 24h)
  const newUsers = users.filter((u) => {
    const diff = now.getTime() - new Date(u.restaurant_created_at).getTime()
    return diff < 24 * 60 * 60 * 1000
  })

  // Positif / Négatif
  const positifs: string[] = []
  const negatifs: string[] = []

  if (newUsers.length > 0)
    positifs.push(`${newUsers.length} nouveau${newUsers.length > 1 ? 'x' : ''} testeur${newUsers.length > 1 ? 's' : ''} inscrit${newUsers.length > 1 ? 's' : ''}`)
  if (activeYesterday.length > 0)
    positifs.push(`${activeYesterday.length}/${totalUsers} testeurs actifs hier`)
  if (Number(avgDuration) > 3)
    positifs.push(`Durée moyenne de session : ${avgDuration} min (engagement solide)`)

  const topFeature = Object.entries(featureTotals).sort((a, b) => b[1] - a[1])[0]
  if (topFeature)
    positifs.push(`Feature la plus utilisée : ${FEATURE_LABELS[topFeature[0]] ?? topFeature[0]} (${topFeature[1]} fois)`)

  const inactiveUsers = users.filter((u) => u.sessions_count === 0 && u.total_events_count === 0)
  if (inactiveUsers.length > 0)
    negatifs.push(`${inactiveUsers.length} testeur${inactiveUsers.length > 1 ? 's' : ''} inactif${inactiveUsers.length > 1 ? 's' : ''} hier`)
  if (totalErrors > 0)
    negatifs.push(`${totalErrors} erreur${totalErrors > 1 ? 's' : ''} remontée${totalErrors > 1 ? 's' : ''}`)
  if (Number(avgDuration) > 0 && Number(avgDuration) < 2)
    negatifs.push(`Durée moyenne de session faible : ${avgDuration} min`)

  const featuresUnused = Object.keys(FEATURE_LABELS).filter((f) => !featureTotals[f])
  if (featuresUnused.length > 0)
    negatifs.push(`Features non testées : ${featuresUnused.map((f) => FEATURE_LABELS[f]).join(', ')}`)

  // HTML users table rows
  const usersRows = users
    .map(
      (u, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${u.restaurant_nom}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555;font-size:13px;">${u.email}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${new Date(u.restaurant_created_at).toLocaleDateString('fr-FR')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${u.sessions_count > 0 || u.total_events_count > 0 ? '<span style="color:#16a34a;font-weight:600;">●</span>' : '<span style="color:#d1d5db;">○</span>'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${u.sessions_count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${u.avg_session_min > 0 ? u.avg_session_min + ' min' : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${u.total_events_count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;color:${u.error_count > 0 ? '#dc2626' : '#9ca3af'};">${u.error_count > 0 ? u.error_count : '—'}</td>
      </tr>`
    )
    .join('')

  // Features table rows
  const featureRows = Object.entries(featureTotals)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([feat, count]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${FEATURE_LABELS[feat] ?? feat}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${featureUsers[feat] ?? 0}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;">${count}</td>
      </tr>`
    )
    .join('')

  const positifsHtml = positifs.length
    ? positifs.map((p) => `<li style="margin:4px 0;color:#166534;">${p}</li>`).join('')
    : '<li style="color:#9ca3af;font-style:italic;">Aucune donnée pour l\'instant</li>'

  const negatifsHtml = negatifs.length
    ? negatifs.map((n) => `<li style="margin:4px 0;color:#991b1b;">${n}</li>`).join('')
    : '<li style="color:#9ca3af;font-style:italic;">Rien à signaler</li>'

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:780px;margin:0 auto;color:#1a1a2e;">

      <!-- Header -->
      <div style="background:#1a1a2e;padding:28px 32px;border-radius:10px 10px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">⚡ Le Rush — Rapport Beta Quotidien</h1>
        <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">📅 ${dateLabel}</p>
      </div>

      <!-- Stats overview -->
      <div style="background:#f1f5f9;padding:20px 32px;display:flex;gap:0;border-bottom:1px solid #e2e8f0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 16px;text-align:center;border-right:1px solid #cbd5e1;">
              <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${totalUsers}<span style="font-size:16px;color:#94a3b8;">/20</span></div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Testeurs inscrits</div>
            </td>
            <td style="padding:8px 16px;text-align:center;border-right:1px solid #cbd5e1;">
              <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${activeYesterday.length}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Actifs hier</div>
            </td>
            <td style="padding:8px 16px;text-align:center;border-right:1px solid #cbd5e1;">
              <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${totalSessions}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Sessions</div>
            </td>
            <td style="padding:8px 16px;text-align:center;border-right:1px solid #cbd5e1;">
              <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${avgDuration}<span style="font-size:14px;color:#94a3b8;">min</span></div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Durée moy.</div>
            </td>
            <td style="padding:8px 16px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:${totalErrors > 0 ? '#dc2626' : '#1a1a2e'};">${totalErrors}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Erreurs</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:24px 32px;">

        <!-- Users table -->
        <h2 style="font-size:16px;font-weight:700;margin:0 0 12px;color:#1a1a2e;">👥 Liste des testeurs</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#1a1a2e;color:#fff;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;">Restaurant</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;">Email</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Inscrit</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Actif hier</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Sessions</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Durée moy.</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Actions</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;">Erreurs</th>
            </tr>
          </thead>
          <tbody>${usersRows}</tbody>
        </table>

        ${
          featureRows
            ? `
        <!-- Feature adoption -->
        <h2 style="font-size:16px;font-weight:700;margin:28px 0 12px;color:#1a1a2e;">🔧 Adoption des fonctionnalités (dernières 24h)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;">Fonctionnalité</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e2e8f0;">Utilisateurs</th>
              <th style="padding:10px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e2e8f0;">Occurrences</th>
            </tr>
          </thead>
          <tbody>${featureRows}</tbody>
        </table>`
            : ''
        }

        <!-- Positive / Negative -->
        <div style="display:flex;gap:24px;margin-top:28px;">
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
            <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#166534;">✅ Positif</h3>
            <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7;">${positifsHtml}</ul>
          </div>
          <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;">
            <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#991b1b;">⚠️ À surveiller</h3>
            <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7;">${negatifsHtml}</ul>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 10px 10px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
          Rapport généré automatiquement · Le Rush · <a href="https://onrush.app" style="color:#94a3b8;">onrush.app</a>
        </p>
      </div>

    </div>
  `

  const { error } = await resend.emails.send({
    from: 'beta@onrush.app',
    to: adminEmail,
    subject: `[Beta] Rapport du ${now.toLocaleDateString('fr-FR')} — ${totalUsers}/20 testeurs · ${activeYesterday.length} actifs`,
    html,
  })

  if (error) throw new Error(`[sendBetaDailyReport] ${error.message}`)
}

export async function sendBonDeCommandeEmail(
  bon: BonDeCommandeData,
  recipientEmail: string,
  pdfBuffer?: Buffer
): Promise<{ success: boolean }> {
  const lignesHtml = bon.lignes
    .map((l) => {
      const total = l.prix_unitaire ? `${(l.quantite * l.prix_unitaire).toFixed(2)} €` : '-'
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${l.nom_produit}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${l.quantite} ${l.unite}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${total}</td>
      </tr>`
    })
    .join('')

  const livraisonHtml = bon.date_livraison_souhaitee
    ? `<p>Livraison souhaitée : <strong>${new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}</strong></p>`
    : ''

  const notesHtml = bon.notes
    ? `<p style="color:#666;margin-top:16px;">Notes : ${bon.notes}</p>`
    : ''

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
      <h2 style="margin-bottom:4px;">Bon de commande — ${bon.restaurant_nom}</h2>
      <p style="color:#666;margin-top:0;">Fournisseur : <strong>${bon.fournisseur.nom}</strong></p>
      ${livraisonHtml}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:10px;text-align:left;">Produit</th>
            <th style="padding:10px;text-align:center;">Quantité</th>
            <th style="padding:10px;text-align:right;">Total HT</th>
          </tr>
        </thead>
        <tbody>${lignesHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:10px;font-weight:bold;border-top:2px solid #1a1a2e;">Total HT</td>
            <td style="padding:10px;font-weight:bold;text-align:right;border-top:2px solid #1a1a2e;">${bon.total_ht.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
      ${notesHtml}
      <p style="color:#999;font-size:12px;margin-top:32px;">Généré via Le Rush — onrush.app</p>
    </div>
  `

  const attachments = pdfBuffer
    ? [{ filename: `bon-de-commande-${bon.id}.pdf`, content: pdfBuffer }]
    : []

  const { error } = await resend.emails.send({
    from: 'commandes@onrush.app',
    to: recipientEmail,
    subject: `Bon de commande ${bon.restaurant_nom} — ${bon.fournisseur.nom}`,
    html: htmlBody,
    attachments,
  })

  if (error) throw new Error(`Email error: ${error.message}`)
  return { success: true }
}
