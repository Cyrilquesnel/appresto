import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Ne pas crasher si Upstash non configuré en dev
const getRedis = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null
  return Redis.fromEnv()
}

const redis = getRedis()

export const dishAnalysisLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '24h'),
      analytics: true,
      prefix: 'dish-analysis',
    })
  : null

export const invoiceOCRLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '24h'),
      prefix: 'invoice-ocr',
    })
  : null

export const globalApiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(200, '1m'),
      prefix: 'global',
    })
  : null
