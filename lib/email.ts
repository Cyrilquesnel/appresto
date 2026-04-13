import { Resend } from 'resend'
import type { BonDeCommandeData } from '@/lib/whatsapp'

const resend = new Resend(process.env.RESEND_API_KEY)

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
      <p style="color:#999;font-size:12px;margin-top:32px;">Généré via Mise en Place — miseenplace.fr</p>
    </div>
  `

  const attachments = pdfBuffer
    ? [{ filename: `bon-de-commande-${bon.id}.pdf`, content: pdfBuffer }]
    : []

  const { error } = await resend.emails.send({
    from: 'commandes@miseenplace.fr',
    to: recipientEmail,
    subject: `Bon de commande ${bon.restaurant_nom} — ${bon.fournisseur.nom}`,
    html: htmlBody,
    attachments,
  })

  if (error) throw new Error(`Email error: ${error.message}`)
  return { success: true }
}
