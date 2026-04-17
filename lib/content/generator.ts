// Génération de contenu social media pour Onrush / Le Rush
// Claude Haiku génère 3 posts/semaine (lundi, mercredi, vendredi)
// Cibles : restaurateurs indépendants français

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Platform = 'instagram' | 'linkedin'
export type ContentType = 'tip' | 'feature' | 'social_proof' | 'engagement' | 'behind_scenes'

export interface GeneratedPost {
  platform: Platform
  content_type: ContentType
  content_text: string
  hashtags: string[]
  publish_date: string // YYYY-MM-DD
}

// Rotation des thèmes pour éviter la répétition
const THEMES = [
  { type: 'tip' as ContentType, angle: 'gain de temps en cuisine et gestion' },
  { type: 'feature' as ContentType, angle: 'fonctionnalité Le Rush : fiches techniques et coûts' },
  { type: 'social_proof' as ContentType, angle: "résultat concret d'un restaurateur" },
  { type: 'tip' as ContentType, angle: 'food cost et rentabilité restaurant' },
  {
    type: 'engagement' as ContentType,
    angle: 'question aux restaurateurs sur leurs défis quotidiens',
  },
  {
    type: 'feature' as ContentType,
    angle: 'fonctionnalité Le Rush : HACCP et sécurité alimentaire',
  },
  {
    type: 'behind_scenes' as ContentType,
    angle: "coulisses du lancement d'une app SaaS restaurant",
  },
]

const SYSTEM_PROMPT = `Tu es expert en marketing B2B pour une app SaaS restaurant française appelée "Le Rush" (aussi "Onrush" en anglais).

Le Rush est une app PWA pour restaurateurs indépendants qui gère : fiches techniques, food cost, HACCP, bons de commande, températures.
Promesse principale : gagner 2h/semaine sur la gestion administrative.

Cible : restaurateurs indépendants français, 30-50 ans, 30-200 couverts, fatigués de la paperasse.

Ton de voix : direct, authentique, pas corporate. Comme un pair restaurateur qui partage son expérience.

Pour Instagram :
- 150-220 mots max
- Accroche forte sur la 1ère ligne (stopper le scroll)
- Emojis dosés (2-4 max)
- CTA clair en fin de post
- 8-12 hashtags pertinents en commentaire

Pour LinkedIn :
- 200-300 mots
- Format storytelling ou liste numérotée
- Moins d'emojis (1-2)
- Focus sur ROI, chiffres, business
- 3-5 hashtags seulement

Réponds UNIQUEMENT avec un JSON valide, sans markdown ni backticks :
{
  "content_text": "...",
  "hashtags": ["hashtag1", "hashtag2"]
}`

export async function generateWeeklyPosts(): Promise<GeneratedPost[]> {
  // Calcule les 3 prochaines dates de publication (lundi, mercredi, vendredi)
  const dates = getNextPublishDates()
  const posts: GeneratedPost[] = []

  // Sélectionne 3 thèmes en rotation basée sur la semaine
  const weekNumber = getWeekNumber(new Date())
  const themeOffset = (weekNumber * 3) % THEMES.length

  const schedule: { platform: Platform; date: string; themeIdx: number }[] = [
    { platform: 'linkedin', date: dates[0], themeIdx: themeOffset % THEMES.length },
    { platform: 'instagram', date: dates[1], themeIdx: (themeOffset + 1) % THEMES.length },
    { platform: 'linkedin', date: dates[2], themeIdx: (themeOffset + 2) % THEMES.length },
  ]

  for (const item of schedule) {
    const theme = THEMES[item.themeIdx]
    try {
      const post = await generatePost(item.platform, theme.type, theme.angle, item.date)
      posts.push(post)
      // Petite pause entre les appels
      await new Promise((r) => setTimeout(r, 1000))
    } catch (err) {
      console.error(
        `[content-generator] Erreur génération ${item.platform}:`,
        (err as Error).message
      )
    }
  }

  return posts
}

async function generatePost(
  platform: Platform,
  contentType: ContentType,
  angle: string,
  publishDate: string
): Promise<GeneratedPost> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Génère un post ${platform} sur le thème : "${angle}". Type : ${contentType}.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'

  // Extraction JSON robuste — cherche le premier { ... } dans la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Pas de JSON dans la réponse Claude: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(jsonMatch[0]) as { content_text: string; hashtags: string[] }

  return {
    platform,
    content_type: contentType,
    content_text: parsed.content_text,
    hashtags: parsed.hashtags ?? [],
    publish_date: publishDate,
  }
}

// Prochains lundi, mercredi, vendredi à partir d'aujourd'hui
function getNextPublishDates(): string[] {
  const today = new Date()
  const dates: string[] = []
  const targetDays = [1, 3, 5] // lundi, mercredi, vendredi

  for (const targetDay of targetDays) {
    const d = new Date(today)
    const currentDay = d.getDay()
    let diff = targetDay - currentDay
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() + diff)
    dates.push(d.toISOString().split('T')[0])
  }

  return dates
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
