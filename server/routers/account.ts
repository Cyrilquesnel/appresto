import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { createServiceClient } from '@/lib/supabase/server'

export const accountRouter = router({
  /**
   * Change le mot de passe de l'utilisateur connecté.
   * Re-authentifie avec le mot de passe actuel avant d'autoriser le changement.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        current_password: z.string().min(1, 'Mot de passe actuel requis'),
        new_password: z.string().min(8, 'Minimum 8 caractères').max(72),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifier le mot de passe actuel via re-authentification
      const { error: signInError } = await ctx.supabase.auth.signInWithPassword({
        email: ctx.user.email!,
        password: input.current_password,
      })
      if (signInError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Mot de passe actuel incorrect',
        })
      }

      const { error } = await ctx.supabase.auth.updateUser({
        password: input.new_password,
      })
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { success: true }
    }),

  /**
   * Change l'adresse email.
   * Supabase envoie automatiquement un email de confirmation aux deux adresses.
   */
  changeEmail: protectedProcedure
    .input(
      z.object({
        new_email: z.string().email("Adresse email invalide"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.auth.updateUser({
        email: input.new_email,
      })
      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
      }

      // Supabase envoie automatiquement un email de confirmation sur les deux adresses
      return { success: true, message: 'Email de confirmation envoyé sur votre ancienne et nouvelle adresse' }
    }),

  /**
   * Supprime définitivement le compte et toutes les données associées.
   * Conforme RGPD Art. 17 — droit à l'effacement.
   * Requiert la saisie explicite de "SUPPRIMER MON COMPTE" pour confirmation.
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal('SUPPRIMER MON COMPTE'),
      })
    )
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id

      // Déconnecter d'abord pour invalider les cookies de session
      await ctx.supabase.auth.signOut()

      // Supprimer l'utilisateur via le client admin (service role)
      // Les données restaurants/plats/ventes sont supprimées en cascade par RLS/FK
      const serviceClient = createServiceClient()
      const { error } = await serviceClient.auth.admin.deleteUser(userId)
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la suppression du compte. Contactez le support.',
        })
      }

      return { success: true }
    }),
})
