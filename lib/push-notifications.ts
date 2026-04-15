import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:contact@onrush.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type { PushSubscription } from 'web-push'

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: {
    url: string
    type?: string
  }
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<void> {
  await webpush.sendNotification(subscription, JSON.stringify(payload), {
    urgency: 'normal',
    TTL: 86400, // 24h
  })
}

export async function sendPMSReminder(subscription: webpush.PushSubscription): Promise<void> {
  await sendPushNotification(subscription, {
    title: 'Le Rush — PMS',
    body: "N'oubliez pas de relever vos températures",
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/pms/temperatures', type: 'pms-reminder' },
  })
}

export async function sendRappelAlert(
  subscription: webpush.PushSubscription,
  produit: string,
  ingredient: string
): Promise<void> {
  await sendPushNotification(subscription, {
    title: 'Alerte rappel produit',
    body: `${produit} (${ingredient}) est concerné par un rappel`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: '/pms/rappels', type: 'rappel-alert' },
  })
}

export async function sendOnboardingNotification(
  subscription: webpush.PushSubscription,
  type: 'j2' | 'j3'
): Promise<void> {
  const messages = {
    j2: {
      body: 'Ajoutez vos prix pour calculer votre food cost automatiquement',
      url: '/mercuriale',
    },
    j3: { body: 'Générez votre premier bon de commande en 2 minutes', url: '/commandes/nouveau' },
  }
  await sendPushNotification(subscription, {
    title: 'Le Rush',
    body: messages[type].body,
    icon: '/icons/icon-192.png',
    data: { url: messages[type].url, type: `onboarding-${type}` },
  })
}
