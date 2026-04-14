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

export async function analyzeDishPhoto(
  imageBase64: string,
  mimeType: string
): Promise<GeminiDishResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-002',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ingredientSchema,
    },
  })

  const result = await model.generateContent([
    `Tu es un expert en restauration professionnelle française.
Analyse cette photo de plat et identifie les ingrédients visibles.
Détecte uniquement ce qui est clairement visible. Ne devine pas les ingrédients cachés.
Indique ta confiance honnêtement (0.0 à 1.0).
Pour les allergènes, utilise : gluten, crustaces, oeufs, poisson, arachides, soja, lait, fruits_a_coque, celeri, moutarde, sesame, sulfites, lupin, mollusques`,
    { inlineData: { mimeType, data: imageBase64 } },
  ])

  return JSON.parse(result.response.text()) as GeminiDishResult
}

export async function analyzeWithRetry(
  imageBase64: string,
  mimeType: string,
  maxRetries = 3
): Promise<GeminiDishResult> {
  let lastError: Error = new Error('Gemini: max retries exceeded')
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyzeDishPhoto(imageBase64, mimeType)
    } catch (error: unknown) {
      lastError = error as Error
      const status = (error as { status?: number }).status
      if (status === 429 || status === 503) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
        continue
      }
      throw error
    }
  }
  throw lastError
}
