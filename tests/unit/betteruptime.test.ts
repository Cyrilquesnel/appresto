import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pingHeartbeat } from '@/lib/betteruptime'

describe('lib/betteruptime — pingHeartbeat', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('pings URL when rappelconso env var set', async () => {
    process.env.BETTERUPTIME_HEARTBEAT_RAPPELCONSO = 'https://betteruptime.com/hb/rappel-abc'
    await pingHeartbeat('rappelconso')
    expect(fetch).toHaveBeenCalledWith('https://betteruptime.com/hb/rappel-abc', {
      method: 'GET',
      cache: 'no-store',
    })
  })

  it('pings URL for temperatures', async () => {
    process.env.BETTERUPTIME_HEARTBEAT_TEMPERATURES = 'https://betteruptime.com/hb/temp-xyz'
    await pingHeartbeat('temperatures')
    expect(fetch).toHaveBeenCalledWith('https://betteruptime.com/hb/temp-xyz', expect.any(Object))
  })

  it('noop when env var missing', async () => {
    delete process.env.BETTERUPTIME_HEARTBEAT_ONBOARDING
    await pingHeartbeat('onboarding')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('swallows fetch errors (does not throw)', async () => {
    process.env.BETTERUPTIME_HEARTBEAT_RAPPELCONSO = 'https://betteruptime.com/hb/rappel-abc'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(pingHeartbeat('rappelconso')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
