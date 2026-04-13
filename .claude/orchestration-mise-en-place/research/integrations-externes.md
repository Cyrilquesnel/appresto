# Recherche : Intégrations Externes

**Date**: 2026-04-12
**Intégrations**: WhatsApp Business, Resend, PDF, Push Web, POS, RappelConso, Upstash

---

## 1. WhatsApp Business API (Meta Cloud API)

### Setup
1. Créer app Meta Business sur developers.facebook.com
2. Ajouter produit "WhatsApp" → obtenir `PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`
3. Vérifier un numéro de téléphone dédié (pas un numéro personnel)
4. Créer templates de messages (approval requise par Meta ~24-48h)

### Pricing France (2025-2026)
- **1 000 conversations/mois gratuites** (conversations initiées par l'entreprise)
- Au-delà : ~$0.055/conversation (Utility category — bons de commande)
- Marketing : ~$0.089/conversation (newsletters, promotions)
- Service (réponse client) : $0.000 si < 24h après message client

### Template bon de commande

```typescript
// lib/whatsapp.ts
const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

export async function sendBonDeCommande(params: {
  to: string               // +33XXXXXXXXX
  fournisseurNom: string
  date: string
  lignes: Array<{ ingredient: string; quantite: number; unite: string }>
  pdfUrl?: string
}) {
  // Option 1 : Message texte structuré (sans template approval)
  const lignesText = params.lignes
    .map(l => `• ${l.ingredient} : ${l.quantite} ${l.unite}`)
    .join('\n')
  
  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'text',
      text: {
        body: `📦 *Bon de commande — ${params.date}*\n\n${lignesText}\n\n_Envoyé depuis Mise en Place_`
      }
    })
  })
  
  return response.json()
}

// Option 2 : Template approuvé avec PDF en pièce jointe
export async function sendBonDeCommandeWithPDF(to: string, pdfUrl: string) {
  return fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: pdfUrl,
        filename: `bon-de-commande-${Date.now()}.pdf`,
        caption: '📦 Votre bon de commande Mise en Place'
      }
    })
  }).then(r => r.json())
}
```

### Sandbox de test
- Numéro test Meta : +1 555 XXXXXXX
- Pas besoin d'approval pour tester avec numéros whitelistés

---

## 2. Resend — Email transactionnel

```bash
npm install resend react-email
```

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBonDeCommandeEmail(params: {
  to: string
  fournisseurNom: string
  restaurantNom: string
  pdfBuffer: Buffer
}) {
  return resend.emails.send({
    from: 'Mise en Place <commandes@miseenplace.fr>',
    to: params.to,
    subject: `Bon de commande — ${params.restaurantNom}`,
    react: BonDeCommandeEmailTemplate({ ...params }),
    attachments: [{
      filename: 'bon-de-commande.pdf',
      content: params.pdfBuffer
    }]
  })
}

// Pricing Resend : 3 000 emails/mois gratuits, puis $20/mois (50K emails)
```

### DNS Setup (domaine)
```
Type  Name              Value
MX    send              feedback-smtp.us-east-1.amazonses.com
TXT   resend._domainkey <DKIM key>
TXT   @                 v=spf1 include:amazonses.com ~all
```

---

## 3. @react-pdf/renderer — Génération PDF

### Contrainte critique : incompatible Edge Runtime

```typescript
// ⚠️ NE PAS utiliser en Edge Runtime (middleware, Edge Functions)
// Utiliser dans une route API Node.js serverless standard

// app/api/generate-pdf/route.ts
// Force Node.js runtime (pas Edge)
export const runtime = 'nodejs'

import { renderToBuffer } from '@react-pdf/renderer'
import { BonDeCommandePDF } from '@/components/pdf/BonDeCommande'
import { DDPPExportPDF } from '@/components/pdf/DDPPExport'

export async function POST(request: Request) {
  const { type, data } = await request.json()
  
  let pdfBuffer: Buffer
  
  if (type === 'bon-de-commande') {
    pdfBuffer = await renderToBuffer(<BonDeCommandePDF data={data} />)
  } else if (type === 'ddpp-export') {
    pdfBuffer = await renderToBuffer(<DDPPExportPDF data={data} />)
  } else {
    return Response.json({ error: 'Type inconnu' }, { status: 400 })
  }
  
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}-${Date.now()}.pdf"`
    }
  })
}
```

```tsx
// components/pdf/BonDeCommande.tsx
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 20, fontWeight: 'bold' },
  table: { width: '100%', marginTop: 20 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 },
  col: { flex: 1, fontSize: 11 }
})

export function BonDeCommandePDF({ data }: { data: BonDeCommandeData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Bon de Commande</Text>
          <Text>{data.date}</Text>
        </View>
        <Text>À : {data.fournisseurNom}</Text>
        <Text>De : {data.restaurantNom}</Text>
        <View style={styles.table}>
          {data.lignes.map((ligne, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.col}>{ligne.ingredient}</Text>
              <Text style={styles.col}>{ligne.quantite} {ligne.unite}</Text>
              <Text style={styles.col}>{ligne.prix_unitaire}€/{ligne.unite}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
```

---

## 4. Intégrations POS

### Lightspeed Restaurant
- **Auth** : OAuth 2.0 (partenariat requis pour accès production)
- **Webhooks** : `order.completed` → envoi vers `/api/webhooks/lightspeed`
- **Statut** : Partnership requis → contacter via developers.lightspeedhq.com

```typescript
// app/api/webhooks/lightspeed/route.ts
import { createHmac } from 'crypto'

export async function POST(request: Request) {
  // Vérification signature HMAC
  const signature = request.headers.get('X-Lightspeed-Signature')
  const body = await request.text()
  const expected = createHmac('sha256', process.env.LIGHTSPEED_WEBHOOK_SECRET!)
    .update(body).digest('hex')
  
  if (signature !== `sha256=${expected}`) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const data = JSON.parse(body)
  
  // Normaliser et insérer en VENTES
  // data.order.items → [{productId, quantity, price}]
  await insertVentes(data)
  
  return Response.json({ ok: true })
}
```

### Zelty
- **Base URL** : `https://api.zelty.fr/v2.7/`
- **Auth** : Bearer token (API key par établissement)
- **Webhooks** : configurable dans dashboard Zelty → HMAC SHA-256

### Tiller by SumUp
- **Auth** : OAuth 2.0 Client Credentials
- **Endpoint ventes** : `GET /api/v1/transactions`

### Abstraction multi-POS (recommandée)

```typescript
// lib/pos/adapter.ts
interface POSAdapter {
  normalizeWebhookPayload(payload: unknown): VenteNormalisee[]
  verifySignature(payload: string, signature: string): boolean
}

class LightspeedAdapter implements POSAdapter { ... }
class ZeltyAdapter implements POSAdapter { ... }
class TillerAdapter implements POSAdapter { ... }

export function getPOSAdapter(source: 'lightspeed' | 'zelty' | 'tiller'): POSAdapter {
  const adapters = { lightspeed: LightspeedAdapter, zelty: ZeltyAdapter, tiller: TillerAdapter }
  return new adapters[source]()
}
```

---

## 5. RappelConso API

### Endpoint principal
```
GET https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records
  ?where=date_de_publication>="2026-04-11"
  &refine=categorie_de_produit:"Alimentation"
  &order_by=date_de_publication DESC
  &limit=100
```

### Cron quotidien (21h00)

```typescript
// app/api/cron/rappelconso/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  // Vérification secret Vercel Cron
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  const response = await fetch(
    `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records` +
    `?where=date_de_publication>="${dateStr}"&refine=categorie_de_produit:"Alimentation"&limit=100`
  )
  const { results: rappels } = await response.json()

  if (!rappels?.length) {
    await pingHeartbeat() // BetterUptime
    return Response.json({ processed: 0 })
  }

  const supabase = createServiceClient()
  let alertsCreated = 0

  for (const rappel of rappels) {
    // Chercher dans mercuriale des restaurants
    const produitNom = rappel.nom_produit_rappele?.toLowerCase() ?? ''
    const marquenom = rappel.nom_marque_produit?.toLowerCase() ?? ''

    const { data: matches } = await supabase
      .from('restaurant_ingredients')
      .select('id, restaurant_id, nom_custom, catalog:ingredients_catalog(nom)')
      .or(`nom_custom.ilike.%${produitNom}%,ingredients_catalog.nom.ilike.%${produitNom}%`)

    for (const match of matches ?? []) {
      await supabase.from('rappel_alerts').upsert({
        restaurant_id: match.restaurant_id,
        rappelconso_id: rappel.reference_fiche,
        produit_nom: rappel.nom_produit_rappele,
        fournisseur: rappel.nom_marque_produit,
        date_alerte: new Date().toISOString(),
        lot_concerne: rappel.identification_des_lots,
        statut: 'nouveau'
      }, { onConflict: 'rappelconso_id,restaurant_id' })

      alertsCreated++
      // Envoyer push notification + email
    }
  }

  await pingHeartbeat()
  return Response.json({ processed: rappels.length, alerts: alertsCreated })
}
```

### vercel.json (configuration crons)
```json
{
  "crons": [
    {
      "path": "/api/cron/rappelconso",
      "schedule": "0 21 * * *"
    },
    {
      "path": "/api/cron/temperature-reminders",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/temperature-reminders-evening",
      "schedule": "0 17 * * *"
    }
  ]
}
```

---

## 6. Upstash Redis — Rate Limiting & Cache

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/upstash.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

// Rate limiters par usage
export const dishAnalysisLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24h"),
  prefix: "dish-analysis",
})

export const invoiceOCRLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "24h"),
  prefix: "invoice-ocr",
})

export const globalApiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(200, "1m"),
  prefix: "global",
})

// Cache RappelConso (évite de re-fetcher)
export async function getCachedRappels(date: string) {
  return redis.get<string[]>(`rappels:${date}`)
}

export async function setCachedRappels(date: string, data: string[]) {
  await redis.set(`rappels:${date}`, data, { ex: 86400 }) // 24h TTL
}

// Pricing Upstash Redis :
// Free : 10 000 commandes/jour (suffisant jusqu'à ~500 restaurants)
// Pay-as-you-go : $0.20/100K commandes
```

---

## 7. OCR Factures Fournisseurs — Gemini Vision

```typescript
// lib/ai/invoice-ocr.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const invoiceSchema = {
  type: SchemaType.OBJECT,
  properties: {
    fournisseur_nom: { type: SchemaType.STRING },
    fournisseur_siret: { type: SchemaType.STRING },
    date_facture: { type: SchemaType.STRING },
    numero_facture: { type: SchemaType.STRING },
    lignes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          designation: { type: SchemaType.STRING },
          reference_lot: { type: SchemaType.STRING },
          dlc: { type: SchemaType.STRING },
          quantite: { type: SchemaType.NUMBER },
          unite: { type: SchemaType.STRING },
          prix_unitaire_ht: { type: SchemaType.NUMBER },
          total_ht: { type: SchemaType.NUMBER }
        }
      }
    },
    total_ttc: { type: SchemaType.NUMBER }
  }
}

export async function extractInvoiceData(imageBase64: string, mimeType: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: invoiceSchema }
  })

  const result = await model.generateContent([
    `Extrais toutes les données structurées de cette facture fournisseur française.
Pour les numéros de lot (référence_lot), cherche : "Lot:", "N° Lot:", "Lot n°", codes alphanumériques.
Pour les DLC, cherche : "À consommer avant le", "DLC:", dates au format JJ/MM/AAAA.
Si une donnée est absente, retourne null.`,
    { inlineData: { mimeType, data: imageBase64 } }
  ])

  return JSON.parse(result.response.text())
}
// Coût : ~$0.0002/facture — 8 factures/mois = $0.0016/restaurant/mois
```
