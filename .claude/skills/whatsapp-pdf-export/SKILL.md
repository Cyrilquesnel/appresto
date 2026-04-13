---
name: whatsapp-pdf-export
description: Export des bons de commande via WhatsApp Business, email Resend, et génération PDF. Utilise quand tu implémentes l'envoi de bons de commande fournisseurs.
---

# WhatsApp + PDF — Bons de commande

## Priorité d'envoi (UX)
1. WhatsApp Business (bouton principal)
2. Email (Resend)
3. PDF téléchargeable

## WhatsApp Business API
```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```
```typescript
// Message texte simple (pas besoin de template approval)
POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
{
  messaging_product: "whatsapp",
  to: "+33XXXXXXXXX",
  type: "text",
  text: { body: "📦 *Bon de commande...*" }
}
// OU document PDF
type: "document", document: { link: pdfUrl, filename: "bon.pdf" }
```
Free tier : 1 000 conversations/mois. Au-delà : ~$0.055/conv.

## PDF — RÈGLE CRITIQUE
**@react-pdf/renderer est incompatible avec Edge Runtime.**
La route API de génération PDF DOIT avoir :
```typescript
export const runtime = 'nodejs'  // obligatoire
```
Utiliser `renderToBuffer()` pour les exports, `renderToStream()` pour les gros fichiers.

## Resend
```typescript
resend.emails.send({
  from: 'commandes@miseenplace.fr',
  to: fournisseurEmail,
  attachments: [{ filename: 'bon.pdf', content: pdfBuffer }]
})
```

## Références
- Code complet : research/integrations-externes.md sections 1-3
