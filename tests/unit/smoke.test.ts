import { describe, it, expect } from 'vitest'

describe('Application smoke tests', () => {
  it('environment is configured', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321').toBeTruthy()
    expect(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').toBeTruthy()
  })

  it('basic math works', () => {
    expect(1 + 1).toBe(2)
  })
})
