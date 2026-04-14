import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface InvoiceLine {
  designation: string
  dlc?: string // format ISO: YYYY-MM-DD
  numero_lot?: string
  quantite: number
  unite: string // 'kg', 'pcs', 'L', etc.
  prix_unitaire_ht: number // en euros HT
  total_ht?: number
}

export interface InvoiceData {
  fournisseur_nom?: string
  date_facture?: string // format ISO: YYYY-MM-DD
  numero_facture?: string
  total_ht_facture?: number
  lignes: InvoiceLine[]
}

const INVOICE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    fournisseur_nom: { type: SchemaType.STRING, nullable: true },
    date_facture: { type: SchemaType.STRING, nullable: true, description: 'Format YYYY-MM-DD' },
    numero_facture: { type: SchemaType.STRING, nullable: true },
    total_ht_facture: { type: SchemaType.NUMBER, nullable: true },
    lignes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          designation: { type: SchemaType.STRING },
          dlc: { type: SchemaType.STRING, nullable: true, description: 'Format YYYY-MM-DD' },
          numero_lot: { type: SchemaType.STRING, nullable: true },
          quantite: { type: SchemaType.NUMBER },
          unite: { type: SchemaType.STRING },
          prix_unitaire_ht: { type: SchemaType.NUMBER },
          total_ht: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['designation', 'quantite', 'unite', 'prix_unitaire_ht'],
      },
    },
  },
  required: ['lignes'],
}

export async function extractInvoiceData(
  imageBase64: string,
  mimeType: string
): Promise<InvoiceData> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-001',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: INVOICE_SCHEMA,
    },
  })

  const result = await model.generateContent([
    {
      inlineData: { data: imageBase64, mimeType },
    },
    `Tu es un expert en lecture de factures de restauration française.
Extrais toutes les informations de cette facture fournisseur.
Pour chaque ligne de produit, extrais:
- La désignation exacte du produit
- La DLC si visible (date limite de consommation)
- Le numéro de lot si visible
- La quantité et l'unité
- Le prix unitaire HT

Si une information n'est pas visible ou lisible, mets null.
Les prix sont en euros HT.`,
  ])

  return JSON.parse(result.response.text()) as InvoiceData
}

/**
 * Matching fuzzy entre le nom de produit de la facture et les ingrédients du restaurant.
 * Priorité : exact > partiel (ingrédient dans designation) > inverse (designation dans ingrédient)
 */
export function matchIngredient(
  designation: string,
  ingredients: { id: string; nom: string }[]
): string | null {
  const needle = designation.toLowerCase().trim()

  const exact = ingredients.find((i) => i.nom.toLowerCase() === needle)
  if (exact) return exact.id

  const partial = ingredients.find((i) => needle.includes(i.nom.toLowerCase()))
  if (partial) return partial.id

  const reverse = ingredients.find((i) => i.nom.toLowerCase().includes(needle))
  if (reverse) return reverse.id

  return null
}
