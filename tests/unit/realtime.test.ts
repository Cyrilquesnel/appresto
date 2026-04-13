import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}
const mockRemoveChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  }),
}))

vi.mock('@/stores/restaurant', () => ({
  useRestaurantStore: vi.fn((selector: (s: { restaurantId: string }) => unknown) =>
    selector({ restaurantId: 'test-restaurant-id' })
  ),
}))

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: vi.fn(() => ({
      dashboard: {
        get: { invalidate: vi.fn() },
        getVentesSemaine: { invalidate: vi.fn() },
      },
    })),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockChannel.on.mockReturnThis()
  mockChannel.subscribe.mockReturnThis()
})

describe('useDashboardRealtime', () => {
  it('subscribe est appelé sur un channel Supabase', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useDashboardRealtime } = await import('@/hooks/useDashboardRealtime')
    renderHook(() => useDashboardRealtime())
    expect(mockChannel.subscribe).toHaveBeenCalled()
  })

  it('removeChannel est appelé au démontage (pas de fuite mémoire)', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useDashboardRealtime } = await import('@/hooks/useDashboardRealtime')
    const { unmount } = renderHook(() => useDashboardRealtime())
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
