import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('posthog-js', () => ({
  default: {
    __loaded: false,
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}))

import posthog from 'posthog-js'
import { trackEvent, identifyUser } from '@/lib/posthog'

describe('lib/posthog — PII sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(posthog as unknown as { __loaded: boolean }).__loaded = true
  })

  it('strips email from event properties', () => {
    trackEvent('dish_photo_analyzed', { email: 'test@example.com', dishId: '123' })
    expect(posthog.capture).toHaveBeenCalledWith('dish_photo_analyzed', { dishId: '123' })
  })

  it('strips multiple PII keys', () => {
    trackEvent('bon_commande_generated', {
      nom: 'Dupont',
      phone: '+33600000000',
      adresse: '1 rue test',
      bonId: 'abc',
      total: 42,
    })
    expect(posthog.capture).toHaveBeenCalledWith('bon_commande_generated', {
      bonId: 'abc',
      total: 42,
    })
  })

  it('preserves non-PII properties', () => {
    trackEvent('temperature_logged', { equipmentId: 'eq1', value: 4, conforme: true })
    expect(posthog.capture).toHaveBeenCalledWith('temperature_logged', {
      equipmentId: 'eq1',
      value: 4,
      conforme: true,
    })
  })

  it('identifyUser strips PII from traits', () => {
    identifyUser('user-123', { email: 'x@x.com', restaurantId: 'r1', plan: 'pro' })
    expect(posthog.identify).toHaveBeenCalledWith('user-123', {
      restaurantId: 'r1',
      plan: 'pro',
    })
  })

  it('noop when posthog not loaded', () => {
    ;(posthog as unknown as { __loaded: boolean }).__loaded = false
    trackEvent('fiche_technique_saved', { ficheId: 'f1' })
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
