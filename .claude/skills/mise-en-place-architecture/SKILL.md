---
name: mise-en-place-architecture
description: Architecture complète du projet Mise en Place. Lit ce skill avant toute implémentation pour comprendre la structure, les modules, les conventions et les règles non négociables.
---

# Architecture — Mise en Place

## Stack
- **Frontend**: Next.js 14 App Router + Tailwind CSS v4 + PWA (@ducanh2912/next-pwa)
- **API**: tRPC v11 (type safety end-to-end)
- **State**: TanStack Query v5 + Zustand v5
- **BDD**: Supabase PostgreSQL + RLS + Realtime + Edge Functions
- **Auth**: Supabase Auth (@supabase/ssr)
- **AI Vision**: Gemini 2.0 Flash (analyse photo plats + OCR factures)
- **AI Text**: Claude Haiku 4.5 (enrichissement allergènes, HACCP)
- **Déploiement**: Vercel (frontend + crons) + Supabase Cloud EU
- **Rate limiting**: Upstash Redis
- **Email**: Resend
- **WhatsApp**: Meta Cloud API
- **PDF**: @react-pdf/renderer (runtime Node.js, PAS Edge)
- **Paiement**: Stripe (SAS La Fabrique Alimentaire)
- **Analytics**: PostHog (EU region)
- **Monitoring**: Sentry + BetterUptime

## Structure dossiers

```
/app
  /(auth)/login, /register
  /(app)/dashboard, /plats, /commandes, /mercuriale, /pms, /settings
  /api/trpc/[trpc]
  /api/analyze-dish
  /api/cron/temperatures, /rappelconso
  /api/stripe/webhook, /checkout
  /api/webhooks/lightspeed, /zelty, /tiller
  /api/generate-pdf
/server
  /trpc.ts (context + middleware)
  /routers/plats, fiches, commandes, dashboard, pms, subscriptions
/lib
  /supabase/server.ts, client.ts
  /ai/gemini.ts, claude-enrichment.ts
  /upstash.ts
  /email.ts
  /whatsapp.ts
/components
  /ui (design system)
  /pdf (BonDeCommande, DDPPExport)
  /pms (TemperatureLogger, Checklist, ReceptionForm)
  /dishes (DishCamera, IngredientValidator, FicheTechniqueForm)
/types/supabase.ts (généré par supabase gen types)
```

## Modules et responsabilités

| Module | Responsabilité |
|---|---|
| OPÉRER | Plats, fiches techniques, allergènes, mise en place |
| ACHETER | Mercuriale, fournisseurs, bons de commande |
| PILOTER | Dashboard, ventes, charges, seuil rentabilité |
| PMS | Températures, checklists, réceptions, HACCP, RappelConso |
| COMPTE | Auth, onboarding, abonnement Stripe |

## Règles non négociables

1. **RLS sur TOUTES les tables dès J1** — jamais de table sans politique
2. **restaurant_id sur TOUTES les tables** — multi-tenant natif
3. **Cascade prix → coûts toujours async** — trigger + Edge Function, jamais synchrone
4. **temperature_logs immuable** — pas de UPDATE ni DELETE (légal)
5. **PDF en Node.js runtime** — PAS Edge Runtime (@react-pdf incompatible)
6. **Mobile-first** — tout validé sur iPhone avant PR merge
7. **Offline PMS** — Background Sync pour relevés températures + checklists

## Convention nommage

- Tables BDD : snake_case (restaurant_ingredients, fiche_technique)
- Composants React : PascalCase (DishCamera, TemperatureLogger)
- tRPC routers : camelCase (plats.create, pms.saveTemperatureLog)
- Variables env : SCREAMING_SNAKE_CASE
- Fichiers : kebab-case (dish-camera.tsx, temperature-logger.tsx)

## Environnements

| Env | Branch | URL | Supabase |
|---|---|---|---|
| Production | main | app.miseenplace.fr | project-prod |
| Staging | develop | staging.miseenplace.fr | project-staging |
| Local | feature/* | localhost:3000 | supabase local |

## Références recherche
- Stack complet : research/next-js-pwa-supabase.md
- BDD + RLS : research/database-multitenant-rls.md
- AI pipeline : research/ai-image-pipeline-food.md
- PMS légal : research/pms-haccp-reglementation-france.md
- Intégrations : research/integrations-externes.md
- CI/CD : research/cicd-devops-testing.md
- Stripe : research/stripe-paiements-implementation.md
