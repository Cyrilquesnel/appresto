import posthog from 'posthog-js'

export const POSTHOG_HOST = 'https://eu.i.posthog.com'

export type AnalyticsEvent =
  | 'dish_photo_analyzed'
  | 'fiche_technique_saved'
  | 'bon_commande_generated'
  | 'temperature_logged'
  | 'ddpp_export_generated'
  | 'onboarding_completed'
  | 'invoice_ocr_processed'

export function initPostHog() {
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || posthog.__loaded) return

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
  })
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown> & { restaurantId?: string }
) {
  if (typeof window === 'undefined') return
  if (!posthog.__loaded) return

  const { restaurantId, ...rest } = properties ?? {}
  posthog.capture(event, sanitizeProperties(rest))

  // Dual-write vers Supabase pour le rapport beta
  if (restaurantId) {
    fetch('/api/beta/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: event, restaurant_id: restaurantId, payload: rest }),
    }).catch(() => {})
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!posthog.__loaded) return
  posthog.identify(userId, sanitizeProperties(traits))
}

export function resetUser() {
  if (typeof window === 'undefined') return
  if (!posthog.__loaded) return
  posthog.reset()
}

const PII_KEYS = ['email', 'phone', 'name', 'nom', 'prenom', 'address', 'adresse', 'password']

function sanitizeProperties(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEYS.some((p) => key.toLowerCase().includes(p))) continue
    clean[key] = value
  }
  return clean
}
