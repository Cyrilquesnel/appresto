export type HeartbeatKey =
  | 'rappelconso'
  | 'temperatures'
  | 'onboarding'
  | 'beta-report'
  | 'google-maps-scrape'
  | 'whatsapp-outreach'
  | 'nurturing-sender'
  | 'prospection-report'

const ENV_KEYS: Record<HeartbeatKey, string> = {
  rappelconso: 'BETTERUPTIME_HEARTBEAT_RAPPELCONSO',
  temperatures: 'BETTERUPTIME_HEARTBEAT_TEMPERATURES',
  onboarding: 'BETTERUPTIME_HEARTBEAT_ONBOARDING',
  'beta-report': 'BETTERUPTIME_HEARTBEAT_BETA_REPORT',
  'google-maps-scrape': 'BETTERUPTIME_HEARTBEAT_GOOGLE_SCRAPE',
  'whatsapp-outreach': 'BETTERUPTIME_HEARTBEAT_WHATSAPP_OUTREACH',
  'nurturing-sender': 'BETTERUPTIME_HEARTBEAT_NURTURING',
  'prospection-report': 'BETTERUPTIME_HEARTBEAT_PROSPECTION_REPORT',
}

export async function pingHeartbeat(key: HeartbeatKey): Promise<void> {
  const url = process.env[ENV_KEYS[key]]
  if (!url) return
  try {
    await fetch(url, { method: 'GET', cache: 'no-store' })
  } catch (err) {
    console.warn(`[betteruptime] heartbeat ${key} failed:`, err)
  }
}
