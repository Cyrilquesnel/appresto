# Task 3.4: Export WhatsApp + Email + PDF

## Objective
Envoi des bons de commande via WhatsApp Business (prioritaire), email Resend, et PDF téléchargeable. Ordre UI : WhatsApp → Email → PDF.

## Context
Selon D10 de DISCOVERY.md, WhatsApp est le premier canal d'envoi (les fournisseurs l'utilisent massivement). Le PDF est généré avec @react-pdf/renderer en runtime Node.js — JAMAIS Edge Runtime. L'email via Resend est le fallback si pas de WhatsApp.

## Dependencies
- Task 3.3 — bons de commande générés avec lignes

## Blocked By
- Task 3.3

## Implementation Plan

### Step 1: lib/whatsapp.ts

```typescript
// lib/whatsapp.ts
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

export interface BonDeCommandeData {
  id: string
  fournisseur: { nom: string; contact_whatsapp?: string }
  date_livraison_souhaitee?: string
  lignes: Array<{ nom_produit: string; quantite: number; unite: string; prix_unitaire?: number }>
  total_ht: number
  notes?: string
  restaurant_nom: string
}

function formatBonMessage(bon: BonDeCommandeData): string {
  const dateLivraison = bon.date_livraison_souhaitee
    ? `\n📅 Livraison souhaitée: ${new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}`
    : ''

  const lignesText = bon.lignes
    .map(l => `• ${l.nom_produit}: ${l.quantite} ${l.unite}${l.prix_unitaire ? ` (${(l.quantite * l.prix_unitaire).toFixed(2)} €)` : ''}`)
    .join('\n')

  return `🛒 *Bon de commande — ${bon.restaurant_nom}*${dateLivraison}

${lignesText}

💶 *Total HT: ${bon.total_ht.toFixed(2)} €*${bon.notes ? `\n\n📝 ${bon.notes}` : ''}

_Bon de commande généré via Mise en Place_`
}

export async function sendBonDeCommande(bon: BonDeCommandeData): Promise<{ success: boolean; messageId?: string }> {
  if (!bon.fournisseur.contact_whatsapp) {
    throw new Error('Numéro WhatsApp du fournisseur manquant')
  }

  const message = formatBonMessage(bon)

  // Nettoyer le numéro (enlever +, espaces)
  const phone = bon.fournisseur.contact_whatsapp.replace(/\D/g, '')

  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return { success: true, messageId: data.messages?.[0]?.id }
}
```

### Step 2: lib/email.ts

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBonDeCommandeEmail(
  bon: import('@/lib/whatsapp').BonDeCommandeData,
  recipientEmail: string,
  pdfBuffer?: Buffer
): Promise<{ success: boolean }> {
  const lignesHtml = bon.lignes
    .map(l => `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${l.nom_produit}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${l.quantite} ${l.unite}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${l.prix_unitaire ? `${(l.quantite * l.prix_unitaire).toFixed(2)} €` : '-'}</td>
    </tr>`)
    .join('')

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Bon de commande — ${bon.restaurant_nom}</h2>
      ${bon.date_livraison_souhaitee ? `<p>📅 Livraison souhaitée: <strong>${new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}</strong></p>` : ''}
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; text-align: left;">Produit</th>
            <th style="padding: 10px; text-align: center;">Quantité</th>
            <th style="padding: 10px; text-align: right;">Total HT</th>
          </tr>
        </thead>
        <tbody>${lignesHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 10px; font-weight: bold;">Total HT</td>
            <td style="padding: 10px; font-weight: bold; text-align: right;">${bon.total_ht.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
      
      ${bon.notes ? `<p style="color: #666;">📝 ${bon.notes}</p>` : ''}
      <p style="color: #999; font-size: 12px; margin-top: 30px;">Généré via Mise en Place — www.miseenplace.fr</p>
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
```

### Step 3: app/api/generate-pdf/route.ts

```typescript
// app/api/generate-pdf/route.ts
// CRITIQUE: export const runtime = 'nodejs' — jamais Edge Runtime
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { BonDeCommandePDF } from '@/components/pdf/BonDeCommande'
import React from 'react'

export async function POST(req: NextRequest) {
  const { type, data } = await req.json()

  if (type === 'bon-de-commande') {
    const buffer = await renderToBuffer(React.createElement(BonDeCommandePDF, { bon: data }))
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bon-de-commande-${data.id}.pdf"`,
      },
    })
  }

  return Response.json({ error: 'Type non supporté' }, { status: 400 })
}
```

### Step 4: components/pdf/BonDeCommande.tsx

```typescript
// components/pdf/BonDeCommande.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  table: { marginTop: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: 8 },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
  total: { flexDirection: 'row', padding: 8, borderTopWidth: 2, borderTopColor: '#1a1a2e', marginTop: 4 },
  totalLabel: { flex: 4, fontWeight: 'bold', fontSize: 12 },
  totalValue: { flex: 1, fontWeight: 'bold', fontSize: 12, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
  notes: { marginTop: 16, padding: 8, backgroundColor: '#f9f9f9' },
})

export function BonDeCommandePDF({ bon }: { bon: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Bon de Commande</Text>
          <Text style={styles.subtitle}>{bon.restaurant_nom} → {bon.fournisseur?.nom}</Text>
          {bon.date_livraison_souhaitee && (
            <Text style={styles.subtitle}>
              Livraison souhaitée: {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
            </Text>
          )}
          <Text style={styles.subtitle}>Date: {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Produit</Text>
            <Text style={styles.col2}>Quantité</Text>
            <Text style={styles.col3}>Total HT</Text>
          </View>
          {bon.lignes?.map((ligne: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{ligne.nom_produit}</Text>
              <Text style={styles.col2}>{ligne.quantite} {ligne.unite}</Text>
              <Text style={styles.col3}>
                {ligne.prix_unitaire ? `${(ligne.quantite * ligne.prix_unitaire).toFixed(2)} €` : '-'}
              </Text>
            </View>
          ))}
          <View style={styles.total}>
            <Text style={styles.totalLabel}>TOTAL HT</Text>
            <Text style={styles.totalValue}>{bon.total_ht?.toFixed(2)} €</Text>
          </View>
        </View>

        {bon.notes && (
          <View style={styles.notes}>
            <Text>Notes: {bon.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Bon de commande généré par Mise en Place — miseenplace.fr
        </Text>
      </Page>
    </Document>
  )
}
```

### Step 5: Composant SendBonOptions

```typescript
// components/commandes/SendBonOptions.tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useRestaurantStore } from '@/stores/restaurant'

interface SendBonOptionsProps {
  bon: any  // bon complet avec fournisseur
  onSent: () => void
}

export function SendBonOptions({ bon, onSent }: SendBonOptionsProps) {
  const [loading, setLoading] = useState<'whatsapp' | 'email' | 'pdf' | null>(null)
  const restaurantId = useRestaurantStore(s => s.restaurantId)
  const updateStatut = trpc.commandes.updateStatutBon.useMutation()

  const sendWhatsApp = async () => {
    setLoading('whatsapp')
    try {
      const res = await fetch('/api/send-bon/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-restaurant-id': restaurantId ?? '' },
        body: JSON.stringify({ bon_id: bon.id }),
      })
      if (!res.ok) throw new Error('Erreur envoi WhatsApp')
      await updateStatut.mutateAsync({ bonId: bon.id, statut: 'envoye', envoye_via: 'whatsapp' })
      onSent()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  const downloadPDF = async () => {
    setLoading('pdf')
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bon-de-commande', data: bon }),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bon-commande-${bon.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await updateStatut.mutateAsync({ bonId: bon.id, statut: 'envoye', envoye_via: 'pdf' })
      onSent()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3" data-testid="send-bon-options">
      {/* WhatsApp — PRIORITÉ 1 selon D10 */}
      {bon.fournisseur?.contact_whatsapp && (
        <button
          onClick={sendWhatsApp}
          disabled={!!loading}
          className="w-full py-4 bg-[#25D366] text-white font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="send-whatsapp-button"
        >
          {loading === 'whatsapp' ? '⏳ Envoi...' : '💬 Envoyer via WhatsApp'}
        </button>
      )}

      {/* Email — PRIORITÉ 2 */}
      {bon.fournisseur?.contact_email && (
        <button
          onClick={() => {/* sendEmail */}}
          disabled={!!loading}
          className="w-full py-4 bg-blue-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="send-email-button"
        >
          {loading === 'email' ? '⏳ Envoi...' : '📧 Envoyer par email'}
        </button>
      )}

      {/* PDF — PRIORITÉ 3 */}
      <button
        onClick={downloadPDF}
        disabled={!!loading}
        className="w-full py-4 bg-gray-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
        data-testid="download-pdf-button"
      >
        {loading === 'pdf' ? '⏳ Génération...' : '📄 Télécharger PDF'}
      </button>
    </div>
  )
}
```

### Step 6: Route API send-bon/whatsapp

```typescript
// app/api/send-bon/whatsapp/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBonDeCommande } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  const { bon_id } = await req.json()

  const supabase = createClient()
  const { data: bon } = await supabase
    .from('bons_de_commande')
    .select('*, fournisseur:fournisseurs(*), lignes:bons_de_commande_lignes(*)')
    .eq('id', bon_id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!bon) return Response.json({ error: 'Bon non trouvé' }, { status: 404 })

  const { data: restaurant } = await supabase.from('restaurants').select('nom').eq('id', restaurantId).single()

  const result = await sendBonDeCommande({
    id: bon.id,
    fournisseur: bon.fournisseur,
    date_livraison_souhaitee: bon.date_livraison_souhaitee,
    lignes: bon.lignes,
    total_ht: bon.total_ht,
    notes: bon.notes,
    restaurant_nom: restaurant?.nom ?? 'Mon restaurant',
  })

  return Response.json(result)
}
```

### Step 7: Tests

```typescript
// tests/unit/pdf-generation.test.ts
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'

describe('BonDeCommandePDF', () => {
  it('génère un buffer non vide', async () => {
    const { BonDeCommandePDF } = await import('@/components/pdf/BonDeCommande')
    const React = await import('react')
    const { renderToBuffer } = await import('@react-pdf/renderer')

    const bon = {
      id: 'test-id',
      restaurant_nom: 'Test Restaurant',
      fournisseur: { nom: 'Test Fournisseur' },
      lignes: [
        { nom_produit: 'Beurre', quantite: 5, unite: 'kg', prix_unitaire: 8.50 },
      ],
      total_ht: 42.50,
    }

    const buffer = await renderToBuffer(React.createElement(BonDeCommandePDF, { bon }))
    expect(buffer.length).toBeGreaterThan(10000) // PDF non vide
  })
})
```

## Files to Create

- `lib/whatsapp.ts`
- `lib/email.ts`
- `app/api/generate-pdf/route.ts` (avec `export const runtime = 'nodejs'`)
- `app/api/send-bon/whatsapp/route.ts`
- `components/pdf/BonDeCommande.tsx`
- `components/commandes/SendBonOptions.tsx`
- `tests/unit/pdf-generation.test.ts`

## Files to Modify

- `app/(app)/commandes/[id]/page.tsx` — intégrer SendBonOptions

## Contracts

### Provides (pour tâches suivantes)
- `GET /api/generate-pdf` → PDF buffer (runtime Node.js)
- `POST /api/send-bon/whatsapp` → envoie WhatsApp + met à jour statut
- `sendBonDeCommandeEmail(bon, email, pdfBuffer?)` → email Resend
- `BonDeCommandePDF` composant réutilisable (sera réutilisé pour DDPP en Phase 5)

### Consumes (de Task 3.3)
- Bon de commande avec lignes + fournisseur (contact WhatsApp + email)

## Acceptance Criteria

- [ ] PDF généré en < 3s (vérifier avec Playwright network timing)
- [ ] Envoyer WhatsApp → message reçu sur numéro test Meta sandbox
- [ ] Envoyer email → reçu via Resend (vérifier dashboard Resend)
- [ ] Statut bon mis à jour à `'envoye'` après envoi
- [ ] PDF contient: logo, date, fournisseur, lignes, total HT
- [ ] `export const runtime = 'nodejs'` dans generate-pdf/route.ts (vérifier)
- [ ] `renderToBuffer` → buffer > 10KB

## Testing Protocol

### Playwright
```typescript
// Générer PDF
await page.goto(`/commandes/${BON_ID}`)
const downloadPromise = page.waitForEvent('download')
await page.click('[data-testid="download-pdf-button"]')
const download = await downloadPromise
expect(download.suggestedFilename()).toMatch(/\.pdf$/)

// Vérifier WhatsApp (via network requests)
await page.click('[data-testid="send-whatsapp-button"]')
await page.waitForResponse(r => r.url().includes('/api/send-bon/whatsapp'))
```

### Vitest
```bash
npm run test:unit -- pdf-generation
```

## Git

- Branch: `phase-3/acheter`
- Commit message prefix: `Task 3.4:`

## PROGRESS.md Update

Marquer Task 3.4 ✅ dans PROGRESS.md.
