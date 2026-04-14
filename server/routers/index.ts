import { router } from '../trpc'
import { platsRouter } from './plats'
import { fichesRouter } from './fiches'
import { commandesRouter } from './commandes'
import { dashboardRouter } from './dashboard'
import { pmsRouter } from './pms'
import { stripeRouter } from './stripe'

export const appRouter = router({
  plats: platsRouter,
  fiches: fichesRouter,
  commandes: commandesRouter,
  dashboard: dashboardRouter,
  pms: pmsRouter,
  stripe: stripeRouter,
})

export type AppRouter = typeof appRouter
