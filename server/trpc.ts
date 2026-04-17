import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import superjson from 'superjson'
import { createClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const ratelimit = {
  api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m') }),
  ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h') }),
  auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
}

export const createTRPCContext = async () => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let restaurantId: string | null = null
  let role: string | null = null

  if (user) {
    const { data: restaurantUser } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, role')
      .eq('user_id', user.id)
      .single()

    restaurantId = restaurantUser?.restaurant_id ?? null
    role = restaurantUser?.role ?? null
  }

  return { user, supabase, restaurantId, role }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.restaurantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      restaurantId: ctx.restaurantId,
    },
  })
})

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.email !== process.env.ADMIN_EMAIL) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// Procédure avec rate limiting pour routes AI (Gemini, OCR)
export const aiProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { success } = await ratelimit.ai.limit(ctx.restaurantId)
  if (!success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Limite atteinte. Réessayez dans 1 heure.',
    })
  }
  return next({ ctx })
})
