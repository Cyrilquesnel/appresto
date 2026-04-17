// Génération de carousels visuels via Gamma API
// textMode: "condense" — Gamma adapte le texte pour qu'il rentre dans les slides
// Dimensions 4x5 (portrait) pour Instagram/LinkedIn

const GAMMA_API = 'https://public-api.gamma.app/v1.0'
// Thème professionnel adapté au secteur restaurant / SaaS B2B
const DEFAULT_THEME = 'default-light'
// Polling : max 20 tentatives × 4s = 80s max
const POLL_INTERVAL_MS = 4000
const POLL_MAX = 20

export async function generateCarousel(
  text: string,
  themeId = DEFAULT_THEME
): Promise<string | null> {
  const apiKey = process.env.GAMMA_API_KEY
  if (!apiKey) {
    console.warn('[gamma] GAMMA_API_KEY manquante — carousel ignoré')
    return null
  }

  // Étape 1 : lancer la génération
  let generationId: string
  try {
    const res = await fetch(`${GAMMA_API}/generations`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'social',
        inputText: text,
        // condense : Gamma adapte le texte pour qu'il rentre dans le format
        // avec une légère marge de sécurité (pas de texte tronqué)
        textMode: 'condense',
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

  // Étape 2 : polling jusqu'à completed
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
