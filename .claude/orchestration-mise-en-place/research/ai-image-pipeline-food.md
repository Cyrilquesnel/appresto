# Recherche : Pipeline IA Image Food (Gemini + Claude)

**Date**: 2026-04-12
**Domaine**: AI Vision + Text enrichment pour analyse de plats

---

## 1. Gemini 2.0 Flash — Vision API

### Pricing (avril 2026)
- Input texte : $0.075 / 1M tokens
- Input image : $0.075 / 1M tokens (images comptées en tokens)
  - Image 768×768 = 258 tokens (1 "tile")
  - Photo mobile standard 1080p = ~4 tiles = ~1 032 tokens image
- Output texte : $0.30 / 1M tokens
- **Coût par analyse photo plat : ~$0.0002**

### Google AI SDK — Next.js App Router

```typescript
// lib/ai/gemini.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ingredientSchema = {
  type: SchemaType.OBJECT,
  properties: {
    type_plat: { type: SchemaType.STRING },
    ingredients_detectes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nom: { type: SchemaType.STRING },
          categorie: { type: SchemaType.STRING,
            enum: ["viande", "poisson", "legume", "feculent", "sauce", "fromage", "autre"] },
          visible: { type: SchemaType.BOOLEAN },
          grammage_suggere: { type: SchemaType.NUMBER },
          allergenes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confiance: { type: SchemaType.NUMBER }
        },
        required: ["nom", "categorie", "visible", "confiance"]
      }
    },
    confiance_globale: { type: SchemaType.NUMBER },
    remarques: { type: SchemaType.STRING }
  },
  required: ["type_plat", "ingredients_detectes", "confiance_globale"]
};

export async function analyzeDishPhoto(imageBase64: string, mimeType: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ingredientSchema,
    },
  });

  const prompt = `Tu es un expert en restauration professionnelle française.
Analyse cette photo de plat et identifie les ingrédients visibles.
Détecte uniquement ce qui est clairement visible.
Ne devine pas les ingrédients cachés.
Indique ta confiance honnêtement (0.0 à 1.0).
Pour les allergènes, utilise : gluten, crustaces, oeufs, poisson, arachides, 
soja, lait, fruits_a_coque, celeri, moutarde, sesame, sulfites, lupin, mollusques`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } }
  ]);

  return JSON.parse(result.response.text());
}
```

### Gestion erreurs Gemini
```typescript
// Erreurs courantes et handling
const GEMINI_ERRORS = {
  429: "Rate limit — attendre 60s et retry",
  503: "Overloaded — retry avec exponential backoff",
  400: "Image invalide ou trop grande — redimensionner",
  "SAFETY": "Contenu bloqué — renvoyer erreur utilisateur"
};

export async function analyzeWithRetry(imageBase64: string, mimeType: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyzeDishPhoto(imageBase64, mimeType);
    } catch (error: any) {
      if (error.status === 429 || error.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 2. Claude Haiku 4.5 — Enrichissement texte

### Pricing
- Input : $0.80 / 1M tokens
- Output : $4.00 / 1M tokens
- Prompt caching (>1024 tokens) : $0.08/1M (cache write) + $0.08/1M (cache read)
- **Coût par enrichissement : ~$0.002** (sans cache) / ~$0.0004 (avec cache sur system prompt)

### Enrichissement allergènes + grammages

```typescript
// lib/ai/claude-enrichment.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `Tu es un expert en nutrition et en réglementation alimentaire française.
Tu enrichis des listes d'ingrédients détectés visuellement avec :
1. Les allergènes réglementaires EU (règlement 1169/2011) — 14 allergènes obligatoires
2. Les grammages typiques en restauration professionnelle
3. Les valeurs nutritionnelles approximatives (kcal/100g)
Réponds UNIQUEMENT en JSON structuré. Sois précis et conservateur sur les allergènes.`;

export async function enrichIngredients(
  ingredients: DetectedIngredient[],
  dishType: string
) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" } // Cache le system prompt
      }
    ],
    messages: [{
      role: "user",
      content: `Enrichis ces ingrédients pour un plat de type "${dishType}":
${JSON.stringify(ingredients, null, 2)}

Retourne JSON avec pour chaque ingrédient :
- allergenes_confirmes: string[] (liste 14 allergènes EU)
- grammage_portion: number (grammes par portion standard)
- kcal_par_100g: number
- unite_standard: "g" | "ml" | "piece"
- notes: string (précisions importantes)`
    }]
  });

  return JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");
}
```

---

## 3. Pipeline 2 étapes — Architecture complète

```typescript
// app/api/analyze-dish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ratelimit } from "@/lib/upstash";
import { uploadToStorage, getSignedUrl } from "@/lib/supabase/storage";
import { analyzeWithRetry } from "@/lib/ai/gemini";
import { enrichIngredients } from "@/lib/ai/claude-enrichment";

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const restaurantId = request.headers.get("x-restaurant-id");
  const { success, remaining } = await ratelimit.limit(`dish-analysis:${restaurantId}`);
  if (!success) {
    return NextResponse.json(
      { error: "Limite d'analyses atteinte (20/jour). Réessayez demain." },
      { status: 429 }
    );
  }

  // 2. Validation + upload image
  const formData = await request.formData();
  const file = formData.get("image") as File;
  
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Format image invalide" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) { // 10MB max
    return NextResponse.json({ error: "Image trop grande (max 10MB)" }, { status: 400 });
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = imageBuffer.toString("base64");
  
  // Upload Supabase Storage (async, non-bloquant)
  const storagePath = `dishes/${restaurantId}/${Date.now()}.jpg`;
  uploadToStorage(storagePath, imageBuffer, file.type); // fire and forget

  // 3. Étape 1 : Gemini Vision
  const geminiResult = await analyzeWithRetry(imageBase64, file.type);
  
  // 4. Étape 2 : Enrichissement Claude si confiance < 0.65
  let finalIngredients = geminiResult.ingredients_detectes;
  
  const lowConfidenceItems = finalIngredients.filter(i => i.confiance < 0.65);
  if (lowConfidenceItems.length > 0 || geminiResult.confiance_globale < 0.65) {
    const enriched = await enrichIngredients(finalIngredients, geminiResult.type_plat);
    finalIngredients = finalIngredients.map(ing => ({
      ...ing,
      ...enriched[ing.nom] ?? {}
    }));
  }

  return NextResponse.json({
    type_plat: geminiResult.type_plat,
    ingredients: finalIngredients,
    confiance_globale: geminiResult.confiance_globale,
    remarques: geminiResult.remarques,
    analyses_restantes: remaining,
    image_url: storagePath
  });
}
```

---

## 4. Rate Limiting — Upstash Redis

```typescript
// lib/upstash.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24h"), // 20 analyses/jour/restaurant
  analytics: true,
  prefix: "mise-en-place",
});

// Rate limit global pour protection DDoS
export const globalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "1m"), // 100 req/min global
  prefix: "global",
});
```

---

## 5. Upload Supabase Storage

```typescript
// lib/supabase/storage.ts
import { createClient } from "@/lib/supabase/server";

export async function uploadDishPhoto(
  file: File,
  restaurantId: string
): Promise<string> {
  const supabase = createClient();
  
  // Validation
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (file.size > maxSize) throw new Error("Image trop grande");
  if (!allowedTypes.includes(file.type)) throw new Error("Format invalide");

  const fileName = `${restaurantId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  
  const { data, error } = await supabase.storage
    .from("dish-photos")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;
  return data.path;
}

// Politique RLS Supabase Storage (SQL)
// CREATE POLICY "restaurant_isolation" ON storage.objects
//   FOR ALL USING (
//     bucket_id = 'dish-photos' AND
//     (storage.foldername(name))[1] = (
//       SELECT restaurant_id::text FROM restaurant_users
//       WHERE user_id = auth.uid() LIMIT 1
//     )
//   );
```

---

## 6. Whisper API — Saisie vocale inventaire

```typescript
// app/api/voice-inventory/route.ts
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI();

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File;
  
  // Transcription en français
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "fr",
    prompt: "Inventaire de cuisine : quantités en grammes, kilos, litres, pièces."
  });

  // Parse avec Claude pour extraire les items structurés
  // "j'ai deux kilos de beurre, cinq cents grammes de lardons"
  // → [{nom: "beurre", quantité: 2, unité: "kg"}, {nom: "lardons", quantité: 500, unité: "g"}]
  
  return NextResponse.json({ transcription: transcription.text });
}

// Coût : $0.006/minute — 2min d'inventaire = $0.012
```

**Composant React enregistrement vocal :**
```typescript
// components/VoiceInventory.tsx
export function VoiceRecorder({ onTranscription }: { onTranscription: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    
    mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "inventory.webm");
      
      const res = await fetch("/api/voice-inventory", { method: "POST", body: formData });
      const { transcription } = await res.json();
      onTranscription(transcription);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <button
      onPointerDown={startRecording}
      onPointerUp={stopRecording}
      className={`rounded-full p-6 ${isRecording ? "bg-red-500 animate-pulse" : "bg-blue-500"}`}
    >
      {isRecording ? "🎙 Parle..." : "🎙 Inventaire vocal"}
    </button>
  );
}
```

---

## 7. Open Food Facts — Seed catalogue ingrédients

### Endpoints utiles
```
# Recherche par catégorie
GET https://world.openfoodfacts.org/category/ingredients/1.json

# Recherche par nom (français)
GET https://fr.openfoodfacts.org/cgi/search.pl?search_terms=beurre&search_simple=1&action=process&json=1

# Export CSV complet (filtré France)
https://static.openfoodfacts.org/data/fr.openfoodfacts.org.products.csv.gz
```

### Script de seed (500 ingrédients courants restauration)
```typescript
// scripts/seed-ingredients-catalog.ts
const COMMON_RESTAURANT_INGREDIENTS = [
  // Viandes
  "boeuf haché", "poulet filet", "veau escalope", "agneau gigot",
  "porc filet", "canard magret", "lapin",
  // Poissons
  "saumon filet", "cabillaud", "thon", "sole", "bar", "dorade",
  // Légumes
  "tomate", "oignon", "ail", "carotte", "courgette", "aubergine",
  "poivron", "champignon", "épinard", "haricot vert", "pomme de terre",
  // Laitages
  "beurre doux", "crème fraîche", "lait entier", "emmental", "parmesan",
  "mozzarella", "comté", "fromage blanc",
  // Féculents
  "farine T55", "riz basmati", "pâtes tagliatelles", "semoule",
  // ... 450 autres
];

// Mapping allergènes Open Food Facts → format app
const ALLERGEN_MAPPING: Record<string, string> = {
  "en:gluten": "gluten",
  "en:milk": "lait",
  "en:eggs": "oeufs",
  "en:fish": "poisson",
  "en:crustaceans": "crustaces",
  "en:shellfish": "mollusques",
  "en:nuts": "fruits_a_coque",
  "en:peanuts": "arachides",
  "en:soybeans": "soja",
  "en:celery": "celeri",
  "en:mustard": "moutarde",
  "en:sesame": "sesame",
  "en:sulphur-dioxide-and-sulphites": "sulfites",
  "en:lupin": "lupin",
};
```

---

## 8. Coûts synthèse par restaurant/mois

| Action | Volume | Coût unitaire | Total/mois |
|--------|---------|---------------|------------|
| Gemini Vision (fiches) | 5/mois | $0.0002 | $0.001 |
| Claude Haiku enrichissement (30%) | 1-2 | $0.002 | $0.003 |
| OCR factures (Gemini) | 8/mois | $0.0002 | $0.0016 |
| HACCP auto-gen (Claude Haiku) | 3/mois | $0.003 | $0.009 |
| Menu engineering (Claude claude-sonnet-4-6) | 1/mois | $0.018 | $0.018 |
| Whisper voice (V2) | 12 min | $0.006/min | $0.072 |
| **Total IA/restaurant/mois** | | | **~$0.10-0.15** |

---

## 9. Variables d'environnement requises

```env
# Gemini
GEMINI_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# OpenAI (Whisper V2)
OPENAI_API_KEY=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Références
- Google AI SDK : https://ai.google.dev/gemini-api/docs/sdks
- Anthropic SDK : https://docs.anthropic.com/en/api/getting-started
- Open Food Facts API : https://wiki.openfoodfacts.org/API
- Upstash Ratelimit : https://github.com/upstash/ratelimit-js
