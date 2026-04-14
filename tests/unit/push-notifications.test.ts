import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}))

// eslint-disable-next-line import/first
import webpush from 'web-push'
import {
  sendPMSReminder,
  sendRappelAlert,
  sendOnboardingNotification,
} from '@/lib/push-notifications'

const mockSubscription = {
  endpoint: 'https://fcm.googleapis.com/test',
  keys: { auth: 'test-auth', p256dh: 'test-p256dh' },
} as webpush.PushSubscription

describe('push-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
  })

  it('sendPMSReminder appelle sendNotification avec le bon payload', async () => {
    await sendPMSReminder(mockSubscription)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      mockSubscription,
      expect.stringContaining('températures'),
      expect.any(Object)
    )
  })

  it('sendRappelAlert inclut le nom du produit dans le body', async () => {
    await sendRappelAlert(mockSubscription, 'Brie de Meaux', 'fromage')
    const call = (webpush.sendNotification as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    const payload = JSON.parse(call![1])
    expect(payload.body).toContain('Brie de Meaux')
    expect(payload.data.url).toBe('/pms/rappels')
  })

  it('sendOnboardingNotification j2 pointe vers /mercuriale', async () => {
    await sendOnboardingNotification(mockSubscription, 'j2')
    const call = (webpush.sendNotification as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    const payload = JSON.parse(call![1])
    expect(payload.data.url).toBe('/mercuriale')
  })

  it('sendOnboardingNotification j3 pointe vers /commandes/nouveau', async () => {
    await sendOnboardingNotification(mockSubscription, 'j3')
    const call = (webpush.sendNotification as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    const payload = JSON.parse(call![1])
    expect(payload.data.url).toBe('/commandes/nouveau')
  })
})
