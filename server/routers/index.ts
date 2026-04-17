import { router } from '../trpc'
import { platsRouter } from './plats'
import { fichesRouter } from './fiches'
import { commandesRouter } from './commandes'
import { dashboardRouter } from './dashboard'
import { pmsRouter } from './pms'
import { stripeRouter } from './stripe'
import { accountRouter } from './account'
import { ingredientsRouter } from './ingredients'
import { prospectionRouter } from './prospection'
import { referralRouter } from './referral'

export const appRouter = router({
  plats: platsRouter,
  fiches: fichesRouter,
  commandes: commandesRouter,
  dashboard: dashboardRouter,
  pms: pmsRouter,
  stripe: stripeRouter,
  account: accountRouter,
  ingredients: ingredientsRouter,
  prospection: prospectionRouter,
  referral: referralRouter,
})

export type AppRouter = typeof appRouter
