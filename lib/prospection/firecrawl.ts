// Client Firecrawl — enrichissement des sites web restaurants
// Docs: https://docs.firecrawl.dev

export interface FirecrawlResult {
  website: string
  menu_snippet: string | null
  type_cuisine: string | null
  couverts_estimes: number | null
  email_contact: string | null
  prix_moyen: number | null
  raw_text: string | null
}

const BASE_URL = 'https://api.firecrawl.dev/v1'
const API_KEY = process.env.FIRECRAWL_API_KEY!

/**
 * Scrape un site de restaurant et extrait les infos clés
 * Timeout agressif : 15s max pour ne pas bloquer le pipeline
 */
export async function enrichRestaurantWebsite(url: string): Promise<FirecrawlResult> {
  const empty: FirecrawlResult = {
    website: url,
    menu_snippet: null,
    type_cuisine: null,
    couverts_estimes: null,
    email_contact: null,
    prix_moyen: null,
    raw_text: null,
  }

  if (!API_KEY) return empty

  // Normaliser l'URL
  const cleanUrl = url.startsWith('http') ? url : `https://${url}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(`${BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 1000,
        timeout: 12000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) return empty

    const data = await response.json()
    const text: string = data?.data?.markdown ?? data?.markdown ?? ''

    if (!text || text.length < 50) return empty

    return {
      website: url,
      menu_snippet: extractMenuSnippet(text),
      type_cuisine: extractTypeCuisine(text),
      couverts_estimes: extractCouverts(text),
      email_contact: extractEmail(text),
      prix_moyen: extractPrixMoyen(text),
      raw_text: text.slice(0, 2000), // Limité pour le scoring Claude
    }
  } catch {
    clearTimeout(timeoutId)
    return empty // Dégradé gracieux — le pipeline continue sans enrichissement
  }
}

// ─── Extracteurs heuristiques ────────────────────────────────

function extractMenuSnippet(text: string): string | null {
  const menuMatch = text.match(/(?:menu|carte|plat[s]?)[^\n]{0,200}/i)
  return menuMatch ? menuMatch[0].trim().slice(0, 200) : null
}

function extractTypeCuisine(text: string): string | null {
  const cuisines = [
    'française',
    'italienne',
    'japonaise',
    'sushi',
    'vietnamienne',
    'indienne',
    'mexicaine',
    'libanaise',
    'méditerranéenne',
    'thai',
    'brasserie',
    'bistrot',
    'gastronomique',
    'bistronomique',
    'pizzeria',
    'burger',
    'végétarien',
    'vegan',
    'seafood',
    'poisson',
    'steakhouse',
    'grill',
    'tapas',
    'bar à vin',
    'rôtisserie',
  ]
  const textLower = text.toLowerCase()
  return cuisines.find((c) => textLower.includes(c)) ?? null
}

function extractCouverts(text: string): number | null {
  const match = text.match(/(\d{2,3})\s*(?:couverts?|places?|personnes?|convives?)/i)
  if (!match) return null
  const n = parseInt(match[1])
  return n >= 20 && n <= 500 ? n : null
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
  if (!match) return null
  // Préférer les emails pro (pas gmail/hotmail/yahoo)
  const pro = match.find(
    (e) => !['gmail.', 'hotmail.', 'yahoo.', 'outlook.', 'free.'].some((d) => e.includes(d))
  )
  return pro ?? match[0]
}

function extractPrixMoyen(text: string): number | null {
  const match = text.match(/(?:menu|formule|prix\s*moyen)[^\d]*(\d{2,3})\s*€/i)
  if (!match) return null
  const prix = parseInt(match[1])
  return prix >= 10 && prix <= 200 ? prix : null
}
