export type HeartbeatKey = 'rappelconso' | 'temperatures' | 'onboarding' | 'beta-report'

const ENV_KEYS: Record<HeartbeatKey, string> = {
  rappelconso: 'BETTERUPTIME_HEARTBEAT_RAPPELCONSO',
  temperatures: 'BETTERUPTIME_HEARTBEAT_TEMPERATURES',
  onboarding: 'BETTERUPTIME_HEARTBEAT_ONBOARDING',
  'beta-report': 'BETTERUPTIME_HEARTBEAT_BETA_REPORT',
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
