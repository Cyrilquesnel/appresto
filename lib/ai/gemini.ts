import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const ingredientSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type_plat: { type: SchemaType.STRING },
    ingredients_detectes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nom: { type: SchemaType.STRING },
          categorie: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: [
              'viande',
              'poisson',
              'legume',
              'feculent',
              'sauce',
              'fromage',
              'laitage',
              'autre',
            ],
          },
          visible: { type: SchemaType.BOOLEAN },
          grammage_suggere: { type: SchemaType.NUMBER },
          allergenes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confiance: { type: SchemaType.NUMBER },
        },
        required: ['nom', 'categorie', 'visible', 'confiance'],
      },
    },
    confiance_globale: { type: SchemaType.NUMBER },
    remarques: { type: SchemaType.STRING },
  },
  required: ['type_plat', 'ingredients_detectes', 'confiance_globale'],
}

export interface DetectedIngredient {
  nom: string
  categorie: string
  visible: boolean
  grammage_suggere?: number
  allergenes?: string[]
  confiance: number
}

export interface GeminiDishResult {
  type_plat: string
  ingredients_detectes: DetectedIngredient[]
  confiance_globale: number
  remarques?: string
}

const SYSTEM_INSTRUCTION = `Tu es un expert en cuisine professionnelle française et en réglementation INCO (information consommateurs).
Tu analyses des photos de plats de restaurant pour construire des fiches techniques HACCP et calculer les food costs.
Règles absolues :
- Identifie UNIQUEMENT ce qui est visuellement certain et clairement visible
- Pour les grammages, utilise les portions standards restaurant professionnel (pas ménager)
- Les 14 codes allergènes réglementaires EU uniquement : gluten, crustaces, oeufs, poisson, arachides, soja, lait, fruits_a_coque, celeri, moutarde, sesame, sulfites, lupin, mollusques
- confiance = 1.0 signifie certitude absolue, confiance < 0.6 → mettre visible: false
- Ne devine jamais un ingrédient non visible`

const FEW_SHOT_PROMPT = `Analyse la photo de plat fournie et identifie les ingrédients visibles.

EXEMPLES DE BONNE ANALYSE :

Exemple 1 — Steak-frites :
{
  "type_plat": "Plat principal viande",
  "ingredients_detectes": [
    {"nom": "entrecôte", "categorie": "viande", "visible": true, "grammage_suggere": 250, "allergenes": [], "confiance": 0.95},
    {"nom": "frites", "categorie": "feculent", "visible": true, "grammage_suggere": 150, "allergenes": ["gluten"], "confiance": 0.98},
    {"nom": "beurre maître d'hôtel", "categorie": "sauce", "visible": true, "grammage_suggere": 20, "allergenes": ["lait"], "confiance": 0.85}
  ],
  "confiance_globale": 0.93,
  "remarques": "Sauce visible mais composition incertaine"
}

Exemple 2 — Salade niçoise :
{
  "type_plat": "Entrée salade",
  "ingredients_detectes": [
    {"nom": "thon", "categorie": "poisson", "visible": true, "grammage_suggere": 80, "allergenes": ["poisson"], "confiance": 0.9},
    {"nom": "oeuf dur", "categorie": "autre", "visible": true, "grammage_suggere": 50, "allergenes": ["oeufs"], "confiance": 0.98},
    {"nom": "haricots verts", "categorie": "legume", "visible": true, "grammage_suggere": 60, "allergenes": [], "confiance": 0.92},
    {"nom": "olives noires", "categorie": "legume", "visible": true, "grammage_suggere": 20, "allergenes": [], "confiance": 0.95},
    {"nom": "anchois", "categorie": "poisson", "visible": false, "grammage_suggere": 10, "allergenes": ["poisson"], "confiance": 0.5}
  ],
  "confiance_globale": 0.85
}

MAINTENANT analyse la photo fournie. Sois aussi précis et exhaustif que possible.`

export async function analyzeDishPhoto(
  imageBase64: string,
  mimeType: string,
  modelName = 'gemini-2.5-flash'
): Promise<GeminiDishResult> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ingredientSchema,
      temperature: 0,
    },
  })

  const result = await model.generateContent([
    FEW_SHOT_PROMPT,
    { inlineData: { mimeType, data: imageBase64 } },
  ])

  return JSON.parse(result.response.text()) as GeminiDishResult
}

export async function analyzeWithRetry(
  imageBase64: string,
  mimeType: string,
  maxRetries = 3
): Promise<GeminiDishResult> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash']
  let lastError: Error = new Error('Gemini: max retries exceeded')

  for (const modelName of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (modelName !== 'gemini-2.5-flash') {
          console.log(`[gemini] fallback sur ${modelName} (attempt ${i + 1})`)
        }
        return await analyzeDishPhoto(imageBase64, mimeType, modelName)
      } catch (error: unknown) {
        lastError = error as Error
        const status = (error as { status?: number }).status
        if (status === 429 || status === 503) {
          if (i < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
          }
          continue
        }
        throw error
      }
    }
    console.warn(
      `[gemini] ${modelName} indisponible après ${maxRetries} tentatives, fallback suivant`
    )
  }

  throw lastError
}
