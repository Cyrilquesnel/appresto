# CLAUDE.md — Mise en Place

## Orchestration M2C1 active
Ce projet utilise le framework M2C1. Avant toute implémentation :

1. Lire `DISCOVERY.md` — document d'autorité
2. Lire `PHASES.md` — plan d'implémentation
3. Lire `PROGRESS.md` — état actuel des tâches
4. Lire le skill `mise-en-place-architecture` avant tout travail de code

## Fichiers clés
| Fichier | Rôle |
|---|---|
| `.claude/orchestration-mise-en-place/DISCOVERY.md` | **Autorité absolue** — toutes les décisions |
| `.claude/orchestration-mise-en-place/PHASES.md` | Plan d'implémentation phasé |
| `.claude/orchestration-mise-en-place/PROGRESS.md` | Statut des tâches |
| `.claude/orchestration-mise-en-place/START.md` | Protocole orchestrateur |

## Stack
Next.js 14 App Router + tRPC + Supabase + Vercel + Gemini 2.0 Flash + Claude Haiku 4.5 + Stripe

## Skills disponibles
| Skill | Usage |
|---|---|
| `mise-en-place-architecture` | Vue d'ensemble, conventions, règles |
| `gemini-vision-food` | Analyse photo plats + OCR factures |
| `supabase-rls-multitenant` | RLS, migrations, triggers |
| `pms-haccp-france` | Module PMS, températures, HACCP |
| `nextjs-pwa-mobile` | PWA, caméra iOS, Service Worker |
| `whatsapp-pdf-export` | Bons de commande WhatsApp/PDF |
| `stripe-subscriptions` | Paiements et abonnements |
| `rappelconso-integration` | API RappelConso, cron alertes |

## Règles non négociables
1. RLS activé sur TOUTES les tables — vérifier avant chaque PR
2. `restaurant_id` sur TOUTES les tables
3. Cascade prix → coûts : TOUJOURS async (Edge Function)
4. `temperature_logs` : JAMAIS de UPDATE ni DELETE
5. `@react-pdf/renderer` : `export const runtime = 'nodejs'` obligatoire
6. Tester sur iPhone avant de marquer une feature comme terminée

## Entité légale
SAS La Fabrique Alimentaire — compte Stripe existant
