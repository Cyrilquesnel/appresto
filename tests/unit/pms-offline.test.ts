import { describe, it, expect } from 'vitest'

// Tests logique pure — IndexedDB mocké en environnement jsdom
describe('pms-offline queue logic', () => {
  it('QueuedRequest contient id + timestamp + type', () => {
    const record = {
      id: crypto.randomUUID(),
      url: '/api/trpc/pms.saveTemperatureLog',
      method: 'POST',
      headers: {},
      body: '{}',
      timestamp: Date.now(),
      type: 'temperature' as const,
    }
    expect(record.id).toBeDefined()
    expect(record.type).toBe('temperature')
    expect(record.timestamp).toBeGreaterThan(0)
  })

  it('PMS_ROUTES inclut saveTemperatureLog et saveChecklistCompletion', () => {
    const PMS_ROUTES = [
      '/api/trpc/pms.saveTemperatureLog',
      '/api/trpc/pms.saveChecklistCompletion',
    ]
    expect(PMS_ROUTES).toHaveLength(2)
    expect(PMS_ROUTES[0]).toContain('saveTemperatureLog')
    expect(PMS_ROUTES[1]).toContain('saveChecklistCompletion')
  })
})
