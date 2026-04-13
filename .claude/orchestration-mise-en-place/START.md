# START.md — Protocole Orchestrateur Mise en Place

## Vue d'ensemble

Ce document décrit le protocole pour l'agent orchestrateur qui lance et coordonne l'exécution des tâches du projet **Mise en Place**.

---

## Pré-requis avant de démarrer

1. **Lire DISCOVERY.md** — document d'autorité absolue
2. **Lire PHASES.md** — plan d'implémentation complet
3. **Lire PROGRESS.md** — état actuel des tâches
4. **Lire le skill `mise-en-place-architecture`** — conventions et règles non négociables

---

## Protocole d'exécution

### Pour chaque tâche

1. **Lire le fichier de tâche** dans `tasks/phase-X/task-X-Y.md`
2. **Vérifier les dépendances** — toutes les dépendances doivent être ✅ avant de commencer
3. **Lire les skills pertinents** (listés dans chaque fichier de tâche)
4. **Explorer les fichiers existants** du projet avant d'écrire une ligne
5. **Implémenter** selon le plan du fichier de tâche
6. **Tester** selon le Testing Protocol du fichier de tâche
7. **Marquer ✅** dans PROGRESS.md
8. **Commiter** avec le prefix de commit indiqué

### Règles d'exécution

- **Une tâche à la fois** — ne jamais commencer une tâche avant que ses dépendances soient ✅
- **Tests obligatoires** — ne jamais marquer ✅ sans avoir exécuté les tests
- **Pas de raccourcis** — si un test échoue, corriger avant de continuer
- **RLS sur tout** — vérifier systématiquement avant chaque PR
- **iPhone avant merge** — tester sur webkit (Playwright) avant de merger

---

## Ordre d'exécution recommandé

```
Phase 1 (Foundation) — séquentiel:
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.R

Phase 2 (OPÉRER) — séquentiel:
  2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.R

Phase 3 (ACHETER) — séquentiel:
  3.1 → 3.2 → 3.3 → 3.4 → 3.R

Phase 4 (PILOTER) — séquentiel:
  4.1 → 4.2 → 4.3 → 4.R

Phase 5 (PMS) — quelques parallélisations possibles:
  5.1 → [5.2, 5.7 en parallèle]
  5.1 + 3.2 → 5.3
  2.3 → 5.4
  3.1 → 5.5
  5.1 + 5.2 + 5.3 + 5.4 → 5.6 → 5.R

Phase 6 (Finitions):
  6.1 (après 2.1 + 4.1)
  6.2 → 6.3 (après 5.5)
  6.4 (après 1.2)
  → 6.R

Phase 7 (CI/CD):
  7.1 (après 1.6)
  7.1 → 7.2
  5.5 + 5.1 → 7.3
  1.2 → 7.4
  All → 7.5 → 7.R

Phase 8 (Beta):
  7.R → 8.1 → 8.2 → 8.3 → 8.4
```

---

## Fichiers de tâches disponibles

```
tasks/
├── phase-1/
│   ├── task-1-1.md  — Next.js 14 + Supabase Init
│   ├── task-1-2.md  — BDD Complète + RLS
│   ├── task-1-3.md  — Auth Flow
│   ├── task-1-4.md  — Rate Limiting
│   ├── task-1-5.md  — Layout Mobile
│   ├── task-1-6.md  — CI/CD Initial
│   └── task-1-R.md  — Régression
├── phase-2/
│   ├── task-2-1.md  — Pipeline Photo Gemini
│   ├── task-2-2.md  — Validation Ingrédients
│   ├── task-2-3.md  — Fiche Technique
│   ├── task-2-4.md  — Enrichissement Claude
│   ├── task-2-5.md  — Cascade Prix
│   └── task-2-R.md  — Régression
├── phase-3/
│   ├── task-3-1.md  — Mercuriale + Fournisseurs
│   ├── task-3-2.md  — OCR Factures
│   ├── task-3-3.md  — Bons de Commande
│   ├── task-3-4.md  — Export WhatsApp/PDF
│   └── task-3-R.md  — Régression
├── phase-4/
│   ├── task-4-1.md  — Saisie Ventes
│   ├── task-4-2.md  — Dashboard KPIs
│   ├── task-4-3.md  — Realtime
│   └── task-4-R.md  — Régression
├── phase-5/
│   ├── task-5-1.md  — Températures (Immuable)
│   ├── task-5-2.md  — Checklists
│   ├── task-5-3.md  — Réceptions
│   ├── task-5-4.md  — HACCP Génération
│   ├── task-5-5.md  — RappelConso
│   ├── task-5-6.md  — Export DDPP
│   ├── task-5-7.md  — Offline PWA
│   └── task-5-R.md  — Régression
├── phase-6/
│   ├── task-6-1.md  — Onboarding 3 Jours
│   ├── task-6-2.md  — PWA Manifest
│   ├── task-6-3.md  — Push Notifications
│   ├── task-6-4.md  — Catalogue Ingrédients
│   └── task-6-R.md  — Régression
├── phase-7/
│   ├── task-7-1.md  — GitHub Actions
│   ├── task-7-2.md  — Sentry + PostHog
│   ├── task-7-3.md  — BetterUptime + Crons
│   ├── task-7-4.md  — pgTAP RLS
│   ├── task-7-5.md  — Déploiement Production
│   └── task-7-R.md  — Régression
└── phase-8/
    ├── task-8-1.md  — Tests Playwright Complets
    ├── task-8-2.md  — Tests Performance
    ├── task-8-3.md  — Validation Sécurité
    └── task-8-4.md  — Préparation Beta
```

---

## Rules non négociables (rappel)

1. **RLS sur TOUTES les tables** — jamais de table sans politique
2. **restaurant_id sur TOUTES les tables** — multi-tenant natif
3. **temperature_logs IMMUABLE** — INSERT uniquement, jamais UPDATE/DELETE (légal)
4. **nettoyage_completions IMMUABLE** — INSERT uniquement
5. **@react-pdf/renderer** — `export const runtime = 'nodejs'` OBLIGATOIRE
6. **Cascade prix → coûts ASYNC** — Edge Function Deno via pg_net, JAMAIS synchrone
7. **Mobile-first** — tester sur iPhone 14 (Playwright webkit) avant merge
8. **WhatsApp d'abord** — ordre envoi: WhatsApp > email > PDF (D10 DISCOVERY.md)
9. **HACCP à la demande** — bouton uniquement, JAMAIS automatique (D7 DISCOVERY.md)
10. **Offline PMS** — Background Sync pour températures + checklists

---

## Signaux d'alarme

Si vous voyez ces patterns, STOP et corriger avant de continuer:
- `UPDATE temperature_logs` — INTERDIT
- `DELETE temperature_logs` — INTERDIT
- `SUPABASE_SERVICE_ROLE_KEY` côté client — INTERDIT
- `runtime: 'edge'` avec @react-pdf — INTERDIT
- Table sans `restaurant_id` — INTERDIT
- Route tRPC sans `protectedProcedure` — VÉRIFIER

---

## Statut des phases

Voir PROGRESS.md pour l'état actuel de chaque tâche.
