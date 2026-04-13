import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null })
        })
      })
    })
  })
}))

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(_opts: unknown) {}
  },
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class MockRatelimit {
    constructor(_opts: unknown) {}
    limit = vi.fn().mockResolvedValue({ success: true })
    static slidingWindow = vi.fn().mockReturnValue({})
  },
}))

describe('tRPC context', () => {
  it('creates context with null user when unauthenticated', async () => {
    const { createTRPCContext } = await import('@/server/trpc')
    const ctx = await createTRPCContext()
    expect(ctx.user).toBeNull()
    expect(ctx.restaurantId).toBeNull()
  })
})
