// Génération de carousels visuels via Gamma API
// textMode "generate" : Gamma génère le contenu depuis le prompt (pas besoin de Claude)
// textMode "condense" : Gamma adapte du texte existant pour les slides
// Dimensions 4x5 (portrait) pour Instagram/LinkedIn

const GAMMA_API = 'https://public-api.gamma.app/v1.0'
const DEFAULT_THEME = 'default-light'
const POLL_INTERVAL_MS = 4000
const POLL_MAX = 20

export type GammaTextMode = 'generate' | 'condense' | 'preserve'

export async function generateCarousel(
  inputText: string,
  themeId = DEFAULT_THEME,
  textMode: GammaTextMode = 'generate'
): Promise<string | null> {
  const apiKey = process.env.GAMMA_API_KEY
  if (!apiKey) {
    console.warn('[gamma] GAMMA_API_KEY manquante — carousel ignoré')
    return null
  }

  let generationId: string
  try {
    const res = await fetch(`${GAMMA_API}/generations`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'social',
        inputText,
        // generate : Gamma crée le contenu depuis le prompt, son propre AI
        // condense : adapte le texte fourni pour qu'il rentre dans les slides (marge de sécurité)
        textMode,
        themeId,
        cardOptions: { dimensions: '4x5' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[gamma] Erreur génération:', res.status, err)
      return null
    }

    const json = (await res.json()) as { generationId: string }
    generationId = json.generationId
  } catch (err) {
    console.error('[gamma] Erreur réseau génération:', err)
    return null
  }

  // Polling jusqu'à completed (max 80s)
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    try {
      const poll = await fetch(`${GAMMA_API}/generations/${generationId}`, {
        headers: { 'X-API-KEY': apiKey },
      })
      const data = (await poll.json()) as {
        status: 'pending' | 'completed' | 'failed'
        gammaUrl?: string
      }

      if (data.status === 'completed') {
        console.log(`[gamma] ✓ Carousel généré: ${data.gammaUrl}`)
        return data.gammaUrl ?? null
      }

      if (data.status === 'failed') {
        console.error('[gamma] Génération échouée:', generationId)
        return null
      }
    } catch (err) {
      console.error('[gamma] Erreur polling:', err)
      return null
    }
  }

  console.warn('[gamma] Timeout polling après', POLL_MAX * POLL_INTERVAL_MS, 'ms')
  return null
}
