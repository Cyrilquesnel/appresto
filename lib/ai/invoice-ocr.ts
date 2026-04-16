import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface InvoiceLine {
  designation: string
  dlc?: string // format ISO: YYYY-MM-DD
  numero_lot?: string
  quantite: number
  unite: string
  prix_unitaire_ht: number
  total_ht?: number
}

export interface InvoiceData {
  fournisseur_nom?: string
  date_facture?: string // format ISO: YYYY-MM-DD
  numero_facture?: string
  total_ht_facture?: number
  lignes: InvoiceLine[]
}

// Schéma permissif — aucune contrainte de format sur les dates
// La normalisation est faite en post-traitement
const INVOICE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    fournisseur_nom: { type: SchemaType.STRING, nullable: true },
    date_facture: { type: SchemaType.STRING, nullable: true },
    numero_facture: { type: SchemaType.STRING, nullable: true },
    total_ht_facture: { type: SchemaType.NUMBER, nullable: true },
    lignes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          designation: { type: SchemaType.STRING },
          dlc: { type: SchemaType.STRING, nullable: true },
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

const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'] as const

/**
 * Extrait les données d'une facture via Gemini Vision.
 * Essaie gemini-2.0-flash en premier (supporte PDF + images nativement),
 * puis gemini-1.5-flash en fallback.
 */
export async function extractInvoiceData(
  imageBase64: string,
  mimeType: string
): Promise<InvoiceData> {
  let lastError: Error | null = null

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: INVOICE_SCHEMA,
        },
      })

      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType } },
        `Tu es un expert en lecture de factures de restauration française.
Extrais toutes les informations de cette facture fournisseur.
Pour chaque ligne de produit, extrais :
- La désignation exacte du produit (garde le texte original)
- La DLC si visible (n'importe quel format de date)
- Le numéro de lot si visible
- La quantité et l'unité (kg, L, pièce, boîte, etc.)
- Le prix unitaire HT en euros

Si une information n'est pas visible, mets null.
Les prix sont en euros HT. Ignore les lignes de total ou de sous-total.`,
      ])

      const raw = JSON.parse(result.response.text()) as InvoiceData
      return normalizeInvoiceData(raw)
    } catch (err) {
      lastError = err as Error
      console.error(`[Gemini OCR] ${modelName} échoué:`, lastError.message)
      continue
    }
  }

  throw new Error(`OCR échoué sur tous les modèles : ${lastError?.message}`)
}

// ─── Normalisation post-extraction ───────────────────────────────────────────

/**
 * Normalise les données brutes de Gemini :
 * - Dates : any format → ISO YYYY-MM-DD
 * - Unités : homogénéisation
 * - Prix : assure que c'est un nombre positif
 */
function normalizeInvoiceData(data: InvoiceData): InvoiceData {
  return {
    ...data,
    date_facture: parseAnyDate(data.date_facture),
    lignes: (data.lignes ?? [])
      .filter((l) => l.prix_unitaire_ht > 0 && l.designation?.trim())
      .map((l) => ({
        ...l,
        designation: l.designation.trim(),
        dlc: parseAnyDate(l.dlc),
        unite: normalizeUnit(l.unite),
        prix_unitaire_ht: Math.abs(l.prix_unitaire_ht),
        quantite: Math.abs(l.quantite),
      })),
  }
}

function parseAnyDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  // ISO déjà correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // DD/MM/YYYY ou DD/MM/YY
  const dmy = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // MM/DD/YYYY (format US rare)
  const mdy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return undefined
}

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'pièce'
  const u = unit.toLowerCase().trim()
  if (['kg', 'kilo', 'kilogramme'].includes(u)) return 'kg'
  if (['l', 'litre', 'litres', 'ltr'].includes(u)) return 'L'
  if (['g', 'gr', 'gramme', 'grammes'].includes(u)) return 'g'
  if (['pce', 'pcs', 'pièce', 'piece', 'unité', 'unite', 'u', 'un'].includes(u)) return 'pièce'
  if (['boite', 'boîte', 'bte', 'bt'].includes(u)) return 'boîte'
  if (['sachet', 'sac'].includes(u)) return 'sachet'
  if (['botte', 'bot'].includes(u)) return 'botte'
  if (['barquette', 'barq'].includes(u)) return 'barquette'
  if (['colis', 'col', 'carton', 'cart'].includes(u)) return 'colis'
  return unit.trim()
}

// ─── Matching amélioré ────────────────────────────────────────────────────────

/**
 * Normalise une désignation pour le matching :
 * - Supprime les accents
 * - Minuscules
 * - Supprime les codes produits (ex: "462G", "REF-123")
 * - Supprime les quantités collées (ex: "6X100G", "28X")
 * - Supprime la ponctuation
 */
export function normalizeDesignation(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime accents
    .toLowerCase()
    .replace(/\b\d+\s*x\s*\d+[a-z]*\b/gi, '') // "6X100G", "12X"
    .replace(/\b\d+[gGkKlLcC][lgL]?\b/g, '') // "462G", "2KG", "1L"
    .replace(/\b\d+\b/g, '') // chiffres isolés
    .replace(/[^a-z\s]/g, ' ') // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distance de Levenshtein normalisée [0-1], 1 = identique */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  const la = a.length
  const lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return 1 - dp[la][lb] / Math.max(la, lb)
}

/** Score intersection de tokens [0-1], 1 = tous les mots en commun */
function tokenIntersectionScore(a: string, b: string): number {
  const tokA = a.split(' ').filter((t) => t.length > 2)
  const tokB = new Set(b.split(' ').filter((t) => t.length > 2))
  if (tokA.length === 0 || tokB.size === 0) return 0
  const common = tokA.filter((t) => tokB.has(t))
  return common.length / Math.max(tokA.length, tokB.size)
}

/**
 * Matching multi-stratégie entre une désignation de facture et les ingrédients du restaurant.
 * Score combiné : exact > partiel > Levenshtein > tokens communs
 * Seuil minimum : 0.5
 */
export function matchIngredient(
  designation: string,
  ingredients: { id: string; nom: string }[]
): string | null {
  const normDesig = normalizeDesignation(designation)
  if (!normDesig) return null

  let bestId: string | null = null
  let bestScore = 0.5 // seuil minimum

  for (const ing of ingredients) {
    const normIng = normalizeDesignation(ing.nom)
    if (!normIng) continue

    // Exact match après normalisation
    if (normDesig === normIng) return ing.id

    // Substring : ingrédient contenu dans désignation ou vice-versa
    const subScore = normDesig.includes(normIng) || normIng.includes(normDesig) ? 0.85 : 0

    // Levenshtein
    const levScore = levenshteinSimilarity(normDesig, normIng)

    // Tokens communs
    const tokScore = tokenIntersectionScore(normDesig, normIng)

    // Score combiné pondéré
    const score = Math.max(subScore, levScore * 0.6 + tokScore * 0.4)

    if (score > bestScore) {
      bestScore = score
      bestId = ing.id
    }
  }

  return bestId
}
