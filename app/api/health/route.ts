import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, boolean> = {}
  const startTime = Date.now()

  // Check Supabase connectivity
  try {
    const supabase = createClient()
    const { error } = await supabase.from('restaurants').select('id').limit(1)
    checks.supabase = !error
  } catch {
    checks.supabase = false
  }

  const allOk = Object.values(checks).every(Boolean)
  const duration = Date.now() - startTime

  return Response.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    },
    { status: allOk ? 200 : 503 }
  )
}
