# Mise en Place — Implementation Phases

**Cible**: Beta fonctionnelle (3-4 testeurs) — S6 depuis démarrage
**Exécution**: Phases séquentielles, sous-agents autonomes par tâche
**Autorité**: DISCOVERY.md prime sur tout autre document

---

## Scope Constraints (hors périmètre — NE PAS implémenter)

- Multi-établissement UI (structure BDD prête, UI non construite avant commercialisation)
- Menu engineering (V2)
- Saisie vocale inventaire Whisper (V2)
- Comparateur prix fournisseurs (V2)
- Alertes trésorerie 15/30j (V2)
- Contrôle écarts inventaire théorique/réel (V2 — vue SQL prête, pas d'UI)
- Intégrations POS Lightspeed/Zelty/Tiller (commercialisation uniquement)
- Benchmarking marché (V3)
- Prévision météo → production (V3)
- Score santé global établissement (V3)
- Stripe / paiements (uniquement pour phase commercialisation — post-beta)
- Multi-langue (français uniquement)
- Score Menu Engineering Star/Vache/Puzzle/Poids mort (V2)
- Carte anti-gaspi (V2)
- Carte saisonnière auto (V2)

---

## Tech Stack

| Layer | Technologie |
|---|---|
| Frontend | Next.js 14 App Router + Tailwind CSS v4 |
| PWA | @ducanh2912/next-pwa + Service Worker custom |
| API | tRPC v11 (type safety end-to-end) |
| State | TanStack Query v5 + Zustand v5 |
| BDD | Supabase PostgreSQL + RLS + Edge Functions |
| Auth | Supabase Auth + @supabase/ssr |
| AI Vision | Gemini 2.0 Flash (analyse photo + OCR factures) |
| AI Text | Claude Haiku 4.5 (allergènes, HACCP) |
| Rate limiting | Upstash Redis |
| Email | Resend |
| WhatsApp | Meta Cloud API |
| PDF | @react-pdf/renderer (runtime Node.js UNIQUEMENT) |
| Monitoring | Sentry + BetterUptime + PostHog (EU) |
| CI/CD | GitHub Actions + Vercel |
| Déploiement | Vercel (frontend + crons) + Supabase Cloud EU |

---

## Skills Reference

Tous les skills dans `.claude/skills/`. Les agents DOIVENT lire les skills pertinents avant de commencer.

| Skill | Quand l'utiliser |
|---|---|
| `mise-en-place-architecture` | Avant tout travail de code — conventions, structure dossiers, règles |
| `supabase-rls-multitenant` | Toute migration SQL, nouvelle table, politique RLS |
| `gemini-vision-food` | Analyse photo plats, OCR factures, pipeline 2 étapes |
| `nextjs-pwa-mobile` | PWA, Service Worker, caméra iOS, push notifications |
| `whatsapp-pdf-export` | Bons de commande WhatsApp/email/PDF, @react-pdf/renderer |
| `pms-haccp-france` | Module PMS, HACCP, températures, conformité légale |
| `rappelconso-integration` | API RappelConso, cron alertes, matching mercuriale |
| `stripe-subscriptions` | Stripe (Phase commercialisation uniquement) |

---

## Tools Reference

| Outil | Usage | Opérations clés |
|---|---|---|
| **Supabase CLI** | Migrations, seed, types TypeScript | `supabase migration new`, `db push`, `gen types typescript` |
| **Vercel CLI** | Déploiement preview + production | `vercel deploy`, `vercel --prod` |
| **Playwright MCP** | Tests E2E mobile, tests regression en live | navigate, click, fill, upload, setOffline, screenshot |
| **GitHub Actions** | CI/CD automatisé | quality, unit-tests, integration-tests, e2e, deploy |

---

## Testing Methods

| Méthode | Outil | Description |
|---|---|---|
| Unit tests | Vitest | Services, routers tRPC, utilitaires, mocks Supabase/Gemini |
| Integration tests | Vitest + Supabase local | Migrations, Edge Functions, triggers, RLS réel |
| RLS isolation tests | pgTAP (SQL) | Vérification isolation inter-restaurant sur toutes tables |
| Browser testing (local) | Playwright MCP | Tous flux UI sur localhost:3000 |
| Browser testing (live) | Playwright MCP | Regression sur URL Vercel preview/prod |
| Mobile testing (iPhone) | Playwright devices['iPhone 14'] | Webkit/Safari — critique avant tout merge |
| Type checking | `tsc --noEmit` | Contrôle types end-to-end (tRPC + Supabase types) |
| Lint | ESLint + Prettier | Qualité et cohérence code |
| Health check | curl `/api/health` | Vérification Supabase up après déploiement |
| Log verification | Vercel logs + Supabase dashboard | Vérifier pas d'erreurs côté serveur |

---

## Phase Overview

| Phase | Objectif | Tâches |
|---|---|---|
| 1: Foundation | Projet Next.js, Supabase, tRPC, auth, CI base | 6 + R |
| 2: OPÉRER | Photo → IA → fiche technique → allergènes → cascade coûts | 5 + R |
| 3: ACHETER | Mercuriale + fournisseurs + bons de commande + WhatsApp/email/PDF | 5 + R |
| 4: PILOTER | Saisie ventes + dashboard food cost + realtime | 4 + R |
| 5: PMS | Températures + checklists + réceptions + HACCP + RappelConso + DDPP + Offline | 8 + R |
| 6: Finitions | Onboarding 3j + PWA complète + push notifications + seed catalogue | 5 + R |
| 7: Déploiement | CI/CD complet + monitoring + Vercel production | 5 + R |
| 8: E2E Testing | Tests complets mobile + RLS + performance + beta | 4 |
| **Total** | | **~47 tâches** |

---

## Phase 1: Foundation & Infrastructure

**Objectif**: Projet Next.js 14 initialisé, Supabase configuré avec schéma complet, auth fonctionnelle, tRPC opérationnel, CI basique.

### Task 1.1: Initialisation projet Next.js 14
- **Objectif**: Créer le projet Next.js 14 avec toutes les dépendances, Tailwind CSS v4, structure de dossiers.
- **Dépendances**: Aucune
- **Bloqué par**: Rien
- **Fichiers**:
  - `package.json`
  - `next.config.ts` (avec PWA config désactivée en dev)
  - `app/layout.tsx` (meta iOS PWA)
  - `app/globals.css` (Tailwind v4 + design tokens)
  - `tailwind.config.ts`
  - `tsconfig.json`
  - `.eslintrc.json`
  - `.prettierrc`
  - `.env.example` (toutes les variables documentées)
  - `public/manifest.json`
- **Contracts**:
  - Structure dossiers conforme à `mise-en-place-architecture` skill
  - Couleurs: primary `#1a1a2e`, accent `#e94560`, success `#10b981`, warning `#f59e0b`, danger `#ef4444`
  - Safe area iOS: `env(safe-area-inset-bottom)` dans le layout
- **Acceptance Criteria**:
  - [ ] `npm run dev` démarre sans erreurs sur localhost:3000
  - [ ] `npm run build` produit un build valide
  - [ ] `npm run typecheck` passe (0 erreur TypeScript)
  - [ ] `npm run lint` passe (0 erreur ESLint)
  - [ ] Page d'accueil s'affiche sur mobile (Playwright iPhone 14)
- **Testing**:
  - [ ] TypeCheck: `tsc --noEmit` sans erreurs
  - [ ] Lint: `eslint .` sans erreurs
  - [ ] Browser: Playwright navigate localhost:3000, screenshot
- **Skills**: `mise-en-place-architecture`, `nextjs-pwa-mobile`

---

### Task 1.2: Supabase Setup + Migrations Schema Complet
- **Objectif**: Projet Supabase créé (local dev), toutes les migrations SQL du schéma complet appliquées, types TypeScript générés.
- **Dépendances**: 1.1
- **Bloqué par**: Task 1.1
- **Fichiers**:
  - `supabase/config.toml`
  - `supabase/migrations/20260101000001_initial_schema.sql` (tables core + OPÉRER + ACHETER + PILOTER)
  - `supabase/migrations/20260101000002_pms_tables.sql` (PMS + events)
  - `supabase/migrations/20260101000003_rls_policies.sql` (toutes politiques RLS)
  - `supabase/migrations/20260101000004_triggers_cascade.sql` (trigger mercuriale + pg_net)
  - `supabase/migrations/20260101000005_search_functions.sql` (search_ingredients, get_plan_limits)
  - `supabase/seed.sql` (données initiales minimales)
  - `supabase/functions/recalculate-costs/index.ts` (Edge Function Deno)
  - `types/supabase.ts` (généré par `supabase gen types`)
  - `lib/supabase/server.ts`
  - `lib/supabase/client.ts`
- **Contracts**:
  - Toutes les tables ont `restaurant_id` + `created_at`
  - RLS activée sur TOUTES les tables (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
  - `temperature_logs` : INSERT seulement, JAMAIS UPDATE ni DELETE
  - `nettoyage_completions` : INSERT seulement, JAMAIS UPDATE ni DELETE
  - Trigger `after_mercuriale_update` → Edge Function `recalculate-costs` (async, pg_net)
  - Fonction `get_user_restaurant_id()` disponible pour toutes les politiques RLS
  - `ingredients_catalog` seedé avec ≥ 20 ingrédients de test pour dev
- **Acceptance Criteria**:
  - [ ] `supabase start` démarre sans erreurs
  - [ ] `supabase db push` applique toutes les migrations
  - [ ] `supabase gen types typescript --local > types/supabase.ts` génère des types valides
  - [ ] Test RLS basique : 2 utilisateurs, 2 restaurants — user A ne voit pas les données de user B
  - [ ] Trigger cascade : UPDATE mercuriale → Edge Function appelée (log Supabase)
- **Testing**:
  - [ ] pgTAP: test isolation RLS (2 restaurants, SELECT inter-restaurant retourne 0)
  - [ ] SQL: INSERT dans temperature_logs puis vérifier UPDATE/DELETE impossible
  - [ ] TypeCheck: `tsc --noEmit` avec les types générés
- **Skills**: `supabase-rls-multitenant`, `mise-en-place-architecture`

---

### Task 1.3: Auth — Supabase Auth + Middleware Next.js
- **Objectif**: Pages login/register fonctionnelles, middleware de protection des routes, session persistée.
- **Dépendances**: 1.2
- **Bloqué par**: Task 1.2
- **Fichiers**:
  - `middleware.ts` (protection routes `/(app)/*`, redirect vers /login)
  - `app/(auth)/login/page.tsx`
  - `app/(auth)/register/page.tsx`
  - `app/(auth)/layout.tsx`
  - `app/(app)/layout.tsx` (layout protégé, navigation mobile)
  - `lib/supabase/server.ts` (createClient avec cookies)
  - `lib/supabase/client.ts` (createBrowserClient)
- **Contracts**:
  - Toute route `/(app)/*` redirige vers `/login` si non authentifié
  - Après login → redirect vers `/dashboard`
  - Après register → création automatique `restaurants` + `restaurant_users` (owner) → redirect `/onboarding`
  - Pas de route publique à protéger sauf `/login`, `/register`, `/api/health`
- **Acceptance Criteria**:
  - [ ] Un utilisateur peut s'inscrire (email + password)
  - [ ] À l'inscription, un restaurant est créé avec `owner_id = user.id` + entrée `restaurant_users` (role: 'owner')
  - [ ] Un utilisateur peut se connecter et accéder à `/dashboard`
  - [ ] Sans session, toute URL `/(app)/*` redirige vers `/login`
  - [ ] Logout fonctionne (session détruite, redirect login)
- **Testing**:
  - [ ] Playwright: flux register complet → vérifier redirect /onboarding
  - [ ] Playwright: login → dashboard → logout → redirect login
  - [ ] Playwright: accès direct /dashboard sans session → redirect /login
  - [ ] Vitest: middleware correctement redirige les routes protégées
- **Skills**: `supabase-rls-multitenant`, `nextjs-pwa-mobile`

---

### Task 1.4: tRPC Setup — Context, Routers, Client
- **Objectif**: tRPC v11 configuré avec contexte Supabase + restaurantId, tous les routers créés (vides), client React Query configuré.
- **Dépendances**: 1.3
- **Bloqué par**: Task 1.3
- **Fichiers**:
  - `server/trpc.ts` (initTRPC + createTRPCContext + protectedProcedure)
  - `server/routers/index.ts` (appRouter)
  - `server/routers/plats.ts` (stub)
  - `server/routers/fiches.ts` (stub)
  - `server/routers/commandes.ts` (stub)
  - `server/routers/dashboard.ts` (stub)
  - `server/routers/pms.ts` (stub)
  - `app/api/trpc/[trpc]/route.ts`
  - `lib/trpc/client.ts` (createTRPCReact)
  - `providers.tsx` (QueryClient + tRPC provider)
  - `stores/restaurant.ts` (Zustand — restaurantId persisté)
- **Contracts**:
  - `createTRPCContext` expose: `{ user, supabase, restaurantId, role }`
  - `protectedProcedure` lève `UNAUTHORIZED` si `ctx.user` null
  - Toutes les routes sous `/api/trpc/*` gérées par le handler fetch
  - Header `x-restaurant-id` transmis automatiquement depuis Zustand store
- **Acceptance Criteria**:
  - [ ] `curl /api/trpc/plats.list` retourne une réponse tRPC (même vide)
  - [ ] TypeCheck passe avec les types AppRouter inférés
  - [ ] Requête non authentifiée → erreur UNAUTHORIZED
  - [ ] `useRestaurantStore` persiste le restaurantId entre rechargements
- **Testing**:
  - [ ] Vitest: test `protectedProcedure` avec mock user null → UNAUTHORIZED
  - [ ] Vitest: test context creation avec user authentifié → restaurantId correct
  - [ ] TypeCheck: `tsc --noEmit` passe sur tous les routers
- **Skills**: `mise-en-place-architecture`

---

### Task 1.5: Health Check + Variables d'Environnement
- **Objectif**: Endpoint `/api/health` opérationnel, fichier `.env.example` complet, `.env.local` configuré pour dev local.
- **Dépendances**: 1.4
- **Bloqué par**: Task 1.4
- **Fichiers**:
  - `app/api/health/route.ts` (check Supabase connectivity)
  - `.env.example` (toutes variables documentées, valeurs vides)
  - `.env.local` (valeurs locales — gitignored)
  - `.gitignore` (inclut .env.local, .env.*.local)
- **Contracts**:
  - `GET /api/health` → `{ status: "ok"|"degraded", checks: { supabase: bool }, timestamp: string }`
  - HTTP 200 si tout ok, 503 si dégradé
  - Variables requises documentées dans `.env.example` avec commentaires explicatifs
- **Acceptance Criteria**:
  - [ ] `curl http://localhost:3000/api/health` retourne `{"status":"ok"}`
  - [ ] `.env.example` contient toutes les variables (Supabase, Gemini, Anthropic, Upstash, Resend, WhatsApp, VAPID, monitoring)
  - [ ] `.env.local` est gitignored
- **Testing**:
  - [ ] curl /api/health → status 200 + JSON valide
  - [ ] Vérifier .gitignore contient .env.local
- **Skills**: `mise-en-place-architecture`

---

### Task 1.6: CI/CD Basique — GitHub Actions
- **Objectif**: Pipeline GitHub Actions minimal : typecheck + lint + unit tests à chaque push.
- **Dépendances**: 1.5
- **Bloqué par**: Task 1.5
- **Fichiers**:
  - `.github/workflows/ci.yml`
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `tests/mocks/supabase.ts`
  - `tests/mocks/gemini.ts`
  - `tests/mocks/anthropic.ts`
  - `playwright.config.ts`
- **Contracts**:
  - Jobs: quality (typecheck + lint) → unit-tests → [deploy preview + e2e sur PR]
  - Tests unitaires dans `tests/unit/`
  - Tests E2E dans `tests/e2e/`
  - Fixtures dans `tests/fixtures/` (images test, données JSON)
- **Acceptance Criteria**:
  - [ ] `npm run test:unit` passe (0 test échoué)
  - [ ] `npm run typecheck` passe
  - [ ] `npm run lint` passe
  - [ ] Pipeline GitHub Actions déclenchée sur push main/develop
- **Testing**:
  - [ ] Push sur develop → vérifier GitHub Actions verte
  - [ ] Vitest: au moins 1 test de smoke (vérifie que la config Vitest fonctionne)
- **Skills**: `mise-en-place-architecture`

---

### Task 1.R: Régression Phase 1
- **Objectif**: Validation complète de toute la Phase 1 sur environnement Vercel preview.
- **Dépendances**: Toutes les tâches Phase 1 complètes
- **Testing**:
  - [ ] Déployer sur Vercel preview (branch develop)
  - [ ] `curl https://preview-url/api/health` → status ok
  - [ ] Playwright: register → login → dashboard → logout sur URL preview
  - [ ] Playwright iPhone 14: même flux sur Safari/Webkit
  - [ ] TypeCheck + lint passe sur le code de la phase
  - [ ] Vérifier logs Vercel + Supabase : aucune erreur 500
  - [ ] Capturer screenshot dashboard vide comme evidence

---

## Phase 2: Pilier OPÉRER — Photo → Fiche Technique

**Objectif**: Flux complet photo → Gemini → validation ingrédients → fiche technique → enrichissement Claude → cascade coûts calculé.

### Task 2.1: Upload Photo + Pipeline Gemini Vision
- **Objectif**: Composant `DishCamera` (caméra iOS native via input[capture]), upload Supabase Storage, analyse Gemini 2.0 Flash, rate limiting Upstash.
- **Dépendances**: 1.4
- **Bloqué par**: Task 1.4 (tRPC context)
- **Fichiers**:
  - `app/api/analyze-dish/route.ts` (pipeline Gemini + rate limit)
  - `lib/ai/gemini.ts` (analyzeDishPhoto + analyzeWithRetry)
  - `lib/upstash.ts` (dishAnalysisLimiter 20/jour + globalApiLimiter)
  - `lib/supabase/storage.ts` (uploadDishPhoto)
  - `components/dishes/DishCamera.tsx` (input[capture="environment"])
  - `app/(app)/plats/nouveau/page.tsx` (page création plat)
- **Contracts**:
  - `POST /api/analyze-dish` accepte `multipart/form-data` avec `image` + header `x-restaurant-id`
  - Réponse: `{ type_plat, ingredients: DetectedIngredient[], confiance_globale, analyses_restantes, image_url }`
  - `DetectedIngredient`: `{ nom, categorie, visible, grammage_suggere?, allergenes?, confiance }`
  - Rate limit: 20 analyses/jour/restaurant (sliding window 24h Upstash)
  - Image stockée dans bucket Supabase `dish-photos/{restaurant_id}/{timestamp}.jpg`
  - Compression client-side si > 2MB avant upload
  - RLS Storage: accès uniquement au dossier du restaurant
- **Acceptance Criteria**:
  - [ ] Upload d'une photo de plat → liste d'ingrédients retournée en < 5s
  - [ ] Rate limit 429 après 20 analyses/jour
  - [ ] Image compressée si > 2MB (vérifier taille en storage)
  - [ ] Image accessible uniquement par le restaurant propriétaire (RLS storage)
  - [ ] Erreur réseau Gemini : retry avec backoff exponentiel (3 tentatives)
- **Testing**:
  - [ ] Vitest: mock Gemini → vérifier parsing réponse JSON correcte
  - [ ] Vitest: mock Upstash → vérifier rate limit déclenche 429
  - [ ] Playwright: upload `tests/fixtures/dish-steak.jpg` → vérifier liste ingrédients visible
  - [ ] Playwright iPhone 14: même test sur Safari
  - [ ] Vérifier log Supabase Storage: fichier présent après upload
- **Skills**: `gemini-vision-food`, `nextjs-pwa-mobile`, `supabase-rls-multitenant`

---

### Task 2.2: Validation et Correction Ingrédients (UI)
- **Objectif**: Interface de validation des ingrédients détectés par Gemini — le restaurateur peut corriger noms, quantités, supprimer/ajouter des ingrédients.
- **Dépendances**: 2.1
- **Bloqué par**: Task 2.1
- **Fichiers**:
  - `components/dishes/IngredientValidator.tsx`
  - `components/dishes/IngredientSearch.tsx` (recherche full-text catalogue)
  - `server/routers/plats.ts` → `plats.searchIngredients` (appel `search_ingredients` SQL)
  - `app/(app)/plats/nouveau/page.tsx` (étape validation)
- **Contracts**:
  - `trpc.plats.searchIngredients({ query, limit })` → `{ id, nom, source, allergenes, score }[]`
  - Appel de la fonction SQL `search_ingredients(query, restaurant_id, 20)`
  - UI : liste d'ingrédients avec ✓ (valider) / ✕ (supprimer) / ✏ (éditer grammage) + champ ajout manuel
  - Ingrédient non trouvé dans catalogue → créé comme `restaurant_ingredients` avec `catalog_id = NULL`
- **Acceptance Criteria**:
  - [ ] L'utilisateur peut supprimer un ingrédient détecté
  - [ ] L'utilisateur peut modifier le grammage d'un ingrédient
  - [ ] La recherche d'un ingrédient (ex: "beurre") retourne des résultats du catalogue en < 500ms
  - [ ] Un ingrédient inconnu peut être ajouté manuellement
  - [ ] Les modifications sont conservées lors de la navigation entre étapes
- **Testing**:
  - [ ] Vitest: `searchIngredients` avec mock Supabase → retourne résultats triés par source ('restaurant' avant 'catalog')
  - [ ] Playwright: modifier grammage d'un ingrédient → valeur persistée
  - [ ] Playwright: rechercher "beurre" → suggestion apparaît dans < 500ms
- **Skills**: `mise-en-place-architecture`, `supabase-rls-multitenant`

---

### Task 2.3: Fiche Technique Complète (CRUD + Versioning)
- **Objectif**: Création et gestion complète d'une fiche technique — plat + ingrédients + grammages + photo + allergènes calculés.
- **Dépendances**: 2.2
- **Bloqué par**: Task 2.2
- **Fichiers**:
  - `server/routers/fiches.ts` (fiches.create, fiches.get, fiches.update, fiches.list)
  - `components/dishes/FicheTechniqueForm.tsx`
  - `app/(app)/plats/[id]/page.tsx` (vue fiche technique)
  - `app/(app)/plats/page.tsx` (liste plats)
  - `components/dishes/AllergenesDisplay.tsx` (14 allergènes EU avec icônes)
- **Contracts**:
  - `trpc.fiches.create({ plat: { nom, photo_url }, ingredients: [{ ingredient_id, grammage, unite, fournisseur_id_habituel? }] })` → `{ plat_id }`
  - À la création → INSERT `plats` + `fiche_technique` (lignes) + `fiche_technique_versions` (snapshot)
  - `trpc.fiches.get({ platId })` → fiche complète avec allergènes calculés (union de tous les ingrédients)
  - Allergènes affichés: 14 allergènes EU selon `research/pms-haccp-reglementation-france.md`
  - `cout_de_revient` calculé lors du trigger cascade (async) — peut être `null` si pas de prix mercuriale
  - `statut` initial: `'brouillon'` → passe à `'actif'` manuellement
- **Acceptance Criteria**:
  - [ ] Créer une fiche technique avec 3+ ingrédients → plat apparu dans la liste
  - [ ] Allergènes affichés correctement (union de tous les ingrédients)
  - [ ] `fiche_technique_versions` contient un snapshot après création
  - [ ] Photo du plat affichée dans la fiche
  - [ ] `cout_de_revient` = null si aucun prix en mercuriale (pas d'erreur)
  - [ ] Modifier une fiche → nouveau snapshot créé dans `fiche_technique_versions`
- **Testing**:
  - [ ] Vitest: `fiches.create` avec mock Supabase → vérifie INSERT plats + fiche_technique + version
  - [ ] Vitest: calcul allergènes → union correcte de plusieurs ingrédients
  - [ ] Playwright: créer fiche technique complète → vérifier affichage allergènes
  - [ ] SQL: vérifier `fiche_technique_versions` after INSERT via Supabase dashboard
- **Skills**: `supabase-rls-multitenant`, `mise-en-place-architecture`

---

### Task 2.4: Enrichissement Claude Haiku — Allergènes + Grammages
- **Objectif**: Enrichissement automatique des ingrédients via Claude Haiku 4.5 (allergènes précis, grammages typiques, kcal). Appelé quand confiance Gemini < 0.65.
- **Dépendances**: 2.1
- **Bloqué par**: Task 2.1
- **Fichiers**:
  - `lib/ai/claude-enrichment.ts` (enrichIngredients avec prompt caching)
  - Intégré dans `app/api/analyze-dish/route.ts` (pipeline étape 2)
- **Contracts**:
  - Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
  - System prompt mis en cache (cache_control: ephemeral) — économie coût
  - Appel uniquement si `confiance_globale < 0.65` OU nb ingrédients `confiance < 0.65 > 0`
  - Output: `{ [nom_ingredient]: { allergenes_confirmes: string[], grammage_portion: number, kcal_par_100g: number, unite_standard: string } }`
  - Timeout: 10s max — si dépassé, continuer sans enrichissement
- **Acceptance Criteria**:
  - [ ] Analyse avec confiance globale < 0.65 → enrichissement Claude déclenché
  - [ ] Analyse avec confiance > 0.65 → Claude NON appelé (économie coût)
  - [ ] Allergènes enrichis correspondent aux 14 allergènes EU
  - [ ] Coût total pipeline (Gemini + Claude) < $0.005 par analyse
  - [ ] Timeout Claude → pipeline continue (pas de 500)
- **Testing**:
  - [ ] Vitest: mock Anthropic SDK → vérifier enrichissement appelé seulement si confiance < 0.65
  - [ ] Vitest: timeout simulation → pipeline retourne résultat partiel sans crash
  - [ ] Vitest: vérifier prompt caching configuré (cache_control présent dans payload)
- **Skills**: `gemini-vision-food`

---

### Task 2.5: Trigger Cascade Prix → Coûts (Edge Function)
- **Objectif**: Trigger PostgreSQL sur `mercuriale` → Edge Function Deno `recalculate-costs` → mise à jour `plats.cout_de_revient` + snapshot version.
- **Dépendances**: 1.2, 2.3
- **Bloqué par**: Tasks 1.2 + 2.3
- **Fichiers**:
  - `supabase/functions/recalculate-costs/index.ts` (Edge Function Deno)
  - `supabase/migrations/20260101000004_triggers_cascade.sql` (trigger after_mercuriale_update)
- **Contracts**:
  - Trigger: `AFTER INSERT OR UPDATE OF prix ON mercuriale WHEN (NEW.est_actif = TRUE)`
  - Edge Function appelée via `net.http_post` (pg_net) — asynchrone, non-bloquant
  - Payload: `{ ingredient_id, nouveau_prix }`
  - Edge Function: récupère toutes les fiches techniques → recalcule cout_de_revient → UPDATE plats + INSERT version
  - JAMAIS d'appel synchrone dans une API route
  - Edge Function protected: `Authorization: Bearer SERVICE_ROLE_KEY`
- **Acceptance Criteria**:
  - [ ] INSERT un prix dans mercuriale → plats.cout_de_revient mis à jour (dans les 5s)
  - [ ] UPDATE prix d'un ingrédient → tous les plats contenant cet ingrédient recalculés
  - [ ] Nouveau snapshot `fiche_technique_versions` créé après recalcul
  - [ ] Appel Edge Function ASYNCHRONE (la transaction mercuriale se termine immédiatement)
  - [ ] Log Edge Function visible dans Supabase dashboard
- **Testing**:
  - [ ] SQL: INSERT mercuriale → vérifier cout_de_revient après 5s dans plats
  - [ ] SQL: UPDATE prix → vérifier plusieurs plats recalculés
  - [ ] Log Supabase: vérifier Edge Function appelée sans erreur
  - [ ] Vitest: mock Edge Function → vérifier calcul cout correct (grammage × prix / 1000)
- **Skills**: `supabase-rls-multitenant`

---

### Task 2.R: Régression Phase 2
- **Objectif**: Validation complète du flux photo → fiche technique → coût de revient.
- **Dépendances**: Toutes les tâches Phase 2 complètes
- **Testing**:
  - [ ] Déployer sur Vercel preview (branch develop)
  - [ ] Playwright iPhone 14: flux complet — upload photo steak → Gemini → validation → fiche technique → allergènes corrects
  - [ ] Playwright: ajouter prix mercuriale → vérifier cout_de_revient mis à jour (< 10s)
  - [ ] pgTAP: un restaurant ne peut pas lire les plats d'un autre
  - [ ] Vérifier Upstash dashboard: rate limit enregistré
  - [ ] Screenshots: page liste plats + fiche technique + allergènes

---

## Phase 3: Pilier ACHETER — Mercuriale & Commandes

**Objectif**: Gestion mercuriale + fournisseurs + génération automatique bons de commande + export WhatsApp/email/PDF.

### Task 3.1: Mercuriale + Fournisseurs CRUD
- **Objectif**: Gestion complète des fournisseurs et de la mercuriale (prix ingrédients par fournisseur).
- **Dépendances**: 2.3
- **Bloqué par**: Task 2.3 (ingrédients créés)
- **Fichiers**:
  - `server/routers/commandes.ts` → procédures fournisseurs + mercuriale
  - `app/(app)/mercuriale/page.tsx`
  - `app/(app)/mercuriale/fournisseurs/page.tsx`
  - `components/mercuriale/FournisseurForm.tsx`
  - `components/mercuriale/MercurialeTable.tsx`
- **Contracts**:
  - `trpc.commandes.createFournisseur({ nom, contact_tel, contact_whatsapp, contact_email, delai_jours, min_commande? })` → `{ id }`
  - `trpc.commandes.setMercurialePrice({ ingredient_id, fournisseur_id, prix, unite })` → trigger cascade automatique
  - `trpc.commandes.getMercuriale()` → `{ ingredient, fournisseur, prix, unite, date_maj }[]`
  - Ingrédient peut avoir plusieurs prix (fournisseurs différents) — `est_actif` pour le prix principal
- **Acceptance Criteria**:
  - [ ] Ajouter un fournisseur avec numéro WhatsApp
  - [ ] Associer un prix à un ingrédient (ex: beurre → Pomona → €8.50/kg)
  - [ ] Modifier un prix → trigger cascade déclenché → cout_de_revient mis à jour
  - [ ] Historique des prix visible par ingrédient
  - [ ] Un fournisseur d'un restaurant n'est pas visible par un autre restaurant (RLS)
- **Testing**:
  - [ ] Vitest: setMercurialePrice → vérifie INSERT avec `est_actif: true` + ancien prix `est_actif: false`
  - [ ] Playwright: ajouter fournisseur + prix beurre → vérifier mercuriale affichée
  - [ ] pgTAP: isolation fournisseurs entre restaurants
- **Skills**: `supabase-rls-multitenant`

---

### Task 3.2: OCR Factures Fournisseurs (Gemini)
- **Objectif**: Photo d'une facture fournisseur → extraction structurée (produits, prix, DLC, numéros lot) → mise à jour automatique mercuriale + réception PMS.
- **Dépendances**: 3.1
- **Bloqué par**: Task 3.1
- **Fichiers**:
  - `lib/ai/invoice-ocr.ts` (extractInvoiceData — Gemini structured output)
  - `app/api/process-invoice/route.ts`
  - `components/mercuriale/InvoiceUpload.tsx`
  - Intégration `server/routers/commandes.ts` → `commandes.processInvoice`
- **Contracts**:
  - Même pipeline upload que `analyze-dish` (Supabase Storage + rate limit)
  - Schéma Gemini: `{ fournisseur_nom, date_facture, lignes: [{ designation, dlc, quantite, unite, prix_unitaire_ht }] }`
  - Matching auto: `designation` → ingrédient existant (fuzzy sur nom)
  - Si match → UPDATE prix mercuriale + INSERT réception PMS (chapitre 5)
  - Si pas de match → afficher pour association manuelle
  - Bucket storage: `invoices/{restaurant_id}/{timestamp}.jpg`
- **Acceptance Criteria**:
  - [ ] Upload facture → données extraites affichées en < 5s
  - [ ] Prix extrait pour un ingrédient connu → mercuriale mise à jour automatiquement
  - [ ] DLC et numéro lot extraits → pré-remplis dans le formulaire de réception
  - [ ] Ingrédient non reconnu → demande d'association manuelle (pas de crash)
  - [ ] Rate limit Upstash: 50 OCR/jour/restaurant
- **Testing**:
  - [ ] Vitest: mock Gemini avec facture test → vérifier parsing schema
  - [ ] Playwright: upload `tests/fixtures/invoice-sample.jpg` → vérifier extraction
  - [ ] Vitest: matching ingrédient → UPDATE mercuriale appelé
- **Skills**: `gemini-vision-food`, `supabase-rls-multitenant`

---

### Task 3.3: Génération Bons de Commande
- **Objectif**: Génération automatique des bons de commande par fournisseur depuis les besoins de production.
- **Dépendances**: 3.1
- **Bloqué par**: Task 3.1
- **Fichiers**:
  - `server/routers/commandes.ts` → `commandes.generateBonDeCommande`, `commandes.listBons`, `commandes.updateStatut`
  - `app/(app)/commandes/page.tsx`
  - `app/(app)/commandes/nouveau/page.tsx`
  - `components/commandes/BonDeCommandeForm.tsx`
  - `components/commandes/BonDeCommandePreview.tsx`
- **Contracts**:
  - `trpc.commandes.generateBonDeCommande({ fournisseur_id, date_livraison_souhaitee, lignes: [{ ingredient_id, quantite, unite }] })` → `{ bon_id }`
  - `total_ht` calculé depuis `mercuriale.prix` × quantités
  - Statuts: `brouillon` → `envoye` → `confirme` → `recu`
  - `envoye_via`: `'whatsapp' | 'email' | 'pdf'` (mis à jour lors de l'envoi en Task 3.4)
  - Un bon de commande peut avoir plusieurs lignes (1 par ingrédient)
- **Acceptance Criteria**:
  - [ ] Générer un bon de commande avec 5 lignes → total HT calculé correctement
  - [ ] Liste des bons avec filtres par statut et fournisseur
  - [ ] Modifier les quantités avant envoi
  - [ ] Statut mis à jour manuellement possible (`confirme`, `recu`)
- **Testing**:
  - [ ] Vitest: generateBonDeCommande → total_ht = somme(quantite × prix_unitaire)
  - [ ] Playwright: créer bon de commande → prévisualisation → vérifier total
  - [ ] pgTAP: bon de commande d'un restaurant non visible par un autre
- **Skills**: `whatsapp-pdf-export`, `supabase-rls-multitenant`

---

### Task 3.4: Export WhatsApp + Email + PDF
- **Objectif**: Envoi des bons de commande via WhatsApp Business (prioritaire), email Resend, et PDF téléchargeable.
- **Dépendances**: 3.3
- **Bloqué par**: Task 3.3
- **Fichiers**:
  - `lib/whatsapp.ts` (sendBonDeCommande + sendBonDeCommandeWithPDF)
  - `lib/email.ts` (sendBonDeCommandeEmail — Resend)
  - `app/api/generate-pdf/route.ts` (export const runtime = 'nodejs')
  - `components/pdf/BonDeCommande.tsx` (@react-pdf/renderer)
  - `components/commandes/SendBonOptions.tsx` (UI choix WhatsApp/email/PDF)
  - Mise à jour `server/routers/commandes.ts` → `commandes.sendBon`
- **Contracts**:
  - `POST /api/generate-pdf` avec `{ type: 'bon-de-commande', data }` → PDF buffer
  - `export const runtime = 'nodejs'` OBLIGATOIRE dans generate-pdf/route.ts
  - WhatsApp: envoi message texte formaté (sans template approval) + option PDF joint
  - Email Resend: `from: 'commandes@miseenplace.fr'` avec PDF en pièce jointe
  - Après envoi → UPDATE `bons_de_commande.statut = 'envoye'` + `envoye_via`
  - Order UI: WhatsApp en premier, puis Email, puis PDF téléchargeable
- **Acceptance Criteria**:
  - [ ] Générer PDF bon de commande → téléchargement en < 3s
  - [ ] Envoyer WhatsApp → message reçu sur numéro test Meta sandbox
  - [ ] Envoyer email → reçu via Resend (vérifier dashboard Resend)
  - [ ] Statut bon mis à jour à `'envoye'` après envoi
  - [ ] PDF contient: logo, date, fournisseur, lignes formatées, total HT
- **Testing**:
  - [ ] Playwright: générer bon → cliquer WhatsApp → vérifier appel API WhatsApp (Playwright network tab)
  - [ ] Playwright: générer PDF → vérifier download déclenché
  - [ ] Vitest: renderToBuffer → buffer non vide
  - [ ] Vérifier Resend dashboard: email envoyé
- **Skills**: `whatsapp-pdf-export`

---

### Task 3.R: Régression Phase 3
- **Objectif**: Validation complète du flux achat.
- **Dépendances**: Toutes les tâches Phase 3 complètes
- **Testing**:
  - [ ] Playwright iPhone 14: ajouter fournisseur → prix mercuriale → générer bon → envoyer WhatsApp
  - [ ] Playwright: upload facture → prix mis à jour auto → nouveau bon pré-rempli
  - [ ] Vérifier cascade: UPDATE prix → cout_de_revient plats mis à jour
  - [ ] pgTAP: isolation complète bons de commande entre restaurants
  - [ ] Screenshots: mercuriale + bon de commande + preview PDF

---

## Phase 4: Pilier PILOTER — Dashboard & Ventes

**Objectif**: Saisie des ventes quotidienne, dashboard food cost + charges + seuil de rentabilité, realtime via Supabase.

### Task 4.1: Saisie Ventes Quotidienne
- **Objectif**: Formulaire rapide de saisie ventes (2 options selon D6 de DISCOVERY.md : couverts × panier moyen OU plat par plat).
- **Dépendances**: 2.3
- **Bloqué par**: Task 2.3 (plats créés)
- **Fichiers**:
  - `server/routers/dashboard.ts` → `dashboard.logVentes`, `dashboard.getVentes`
  - `app/(app)/dashboard/saisie-ventes/page.tsx`
  - `components/dashboard/SaisieVentesSimple.tsx` (couverts × panier moyen)
  - `components/dashboard/SaisieVentesDetail.tsx` (plat par plat)
  - `components/dashboard/ChargesForm.tsx`
- **Contracts**:
  - Mode simple: `{ nb_couverts, panier_moyen, service, date }` → INSERT ventes avec `plat_id = null`
  - Mode détaillé: `{ plat_id, quantite, prix_vente, service, date }[]` → INSERT plusieurs ventes
  - Préférence stockée dans `restaurants.parametres.mode_ventes = 'simple' | 'detail'`
  - CA estimé mode simple = `nb_couverts × panier_moyen`
- **Acceptance Criteria**:
  - [ ] Saisie rapide en mode simple : 3 champs max, validé en < 30s
  - [ ] Saisie détaillée : sélection plats depuis liste, quantités
  - [ ] Changement de mode possible dans paramètres
  - [ ] Données persistées avec `date` et `service` corrects
- **Testing**:
  - [ ] Vitest: logVentes mode simple → INSERT correct avec montant calculé
  - [ ] Playwright: saisie 2 services (midi + soir) → vérifier 2 entrées en BDD
- **Skills**: `supabase-rls-multitenant`

---

### Task 4.2: Dashboard Food Cost + Charges
- **Objectif**: Dashboard mobile : food cost %, masse salariale, charges fixes, seuil de rentabilité — données du mois courant.
- **Dépendances**: 4.1
- **Bloqué par**: Task 4.1
- **Fichiers**:
  - `server/routers/dashboard.ts` → `dashboard.get` (KPIs complets)
  - `app/(app)/dashboard/page.tsx`
  - `components/dashboard/FoodCostCard.tsx`
  - `components/dashboard/ChargesCard.tsx`
  - `components/dashboard/SeuilRentabiliteCard.tsx`
  - `components/dashboard/VentesSemaineChart.tsx` (graphique simple)
- **Contracts**:
  - `trpc.dashboard.get({ periode: 'mois' | 'semaine' })` retourne:
    ```
    {
      ca_total: number,
      food_cost_euros: number,
      food_cost_pct: number,        // food_cost_euros / ca_total × 100
      masse_salariale: number,
      charges_fixes: number,
      marge_brute: number,          // ca_total - food_cost - masse_salariale - charges
      seuil_rentabilite: number,    // charges_fixes / (1 - food_cost_pct/100)
      nb_couverts: number,
      panier_moyen: number
    }
    ```
  - Chargement initial < 1s (objectif DISCOVERY.md)
  - Food cost = somme(cout_de_revient × quantite) / ca_total — null si pas de prix mercuriale
- **Acceptance Criteria**:
  - [ ] Dashboard s'affiche en < 1s (mesurer avec Playwright performance)
  - [ ] Food cost % correct sur données de test
  - [ ] Seuil de rentabilité affiché (ou "Ajoutez vos charges pour voir le seuil")
  - [ ] Données null/manquantes → placeholders clairs (pas d'erreur)
  - [ ] Responsive mobile-first (iPhone 14 Playwright)
- **Testing**:
  - [ ] Vitest: calcul food_cost_pct correct avec données test
  - [ ] Playwright: mesurer temps de chargement dashboard (< 1000ms)
  - [ ] Playwright iPhone 14: screenshot dashboard — vérifier rendu mobile
- **Skills**: `supabase-rls-multitenant`, `nextjs-pwa-mobile`

---

### Task 4.3: Realtime Dashboard (Supabase Realtime)
- **Objectif**: Dashboard mis à jour automatiquement quand des ventes sont saisies ou des prix modifiés.
- **Dépendances**: 4.2
- **Bloqué par**: Task 4.2
- **Fichiers**:
  - `hooks/useDashboardRealtime.ts`
  - Intégré dans `app/(app)/dashboard/page.tsx`
- **Contracts**:
  - Écoute changes sur `ventes` + `plats` (colonnes: `cout_de_revient`) filtrés par `restaurant_id`
  - Changement → `utils.dashboard.get.invalidate()` → refetch automatique TanStack Query
  - Pas de polling — uniquement WebSocket Supabase Realtime
  - Désabonnement automatique au démontage du composant
- **Acceptance Criteria**:
  - [ ] Saisir une vente dans un onglet → dashboard mis à jour dans un autre onglet en < 3s
  - [ ] Pas de fuite mémoire (channel bien désubscrit au démontage)
- **Testing**:
  - [ ] Playwright: 2 onglets — saisir vente onglet 1 → vérifier mise à jour onglet 2 (< 3s)
  - [ ] Vitest: hook useDashboardRealtime — vérifier subscribe/unsubscribe appelés
- **Skills**: `mise-en-place-architecture`

---

### Task 4.R: Régression Phase 4
- **Objectif**: Validation complète du dashboard et du flux de pilotage.
- **Dépendances**: Toutes les tâches Phase 4 complètes
- **Testing**:
  - [ ] Playwright iPhone 14: saisie ventes → dashboard mis à jour en temps réel
  - [ ] Playwright: mesurer performance dashboard (< 1000ms avec Playwright Performance API)
  - [ ] pgTAP: ventes d'un restaurant non visibles par un autre
  - [ ] Screenshots: dashboard complet avec données réelles

---

## Phase 5: Module PMS

**Objectif**: Module complet PMS légalement conforme — températures, checklists, réceptions, HACCP, RappelConso, export DDPP, offline-first.

### Task 5.1: Équipements + Relevés Températures (Immuable)
- **Objectif**: Gestion des équipements, saisie des relevés de température (2 taps), alertes hors-plage, immuabilité légale.
- **Dépendances**: 1.2
- **Bloqué par**: Task 1.2 (tables PMS créées)
- **Fichiers**:
  - `server/routers/pms.ts` → `pms.createEquipement`, `pms.saveTemperatureLog`, `pms.getTemperatureLogs`
  - `app/(app)/pms/temperatures/page.tsx`
  - `components/pms/TemperatureLogger.tsx` (saisie 2 taps — grand bouton + numpad)
  - `components/pms/EquipementSetup.tsx`
  - `components/pms/TemperatureHistoryChart.tsx`
- **Contracts**:
  - `pms.createEquipement({ nom, type, temp_min, temp_max, frequence_releve })` → `{ id }`
  - Valeurs par défaut selon DISCOVERY.md D17: frigo [0,4], congélateur [-25,-18], bain-marie [63,85]
  - `pms.saveTemperatureLog({ equipement_id, valeur, action_corrective? })` → INSERT UNIQUEMENT (jamais UPDATE)
  - Colonne `conforme` GENERATED ALWAYS AS (`valeur BETWEEN temp_min AND temp_max`) STORED
  - Alerte immédiate côté UI si `conforme = false`
  - RLS: INSERT seulement, SELECT par restaurant — AUCUNE politique UPDATE ni DELETE
- **Acceptance Criteria**:
  - [ ] Configurer un frigo (seuils 0-4°C)
  - [ ] Saisir 3.5°C → conforme = true
  - [ ] Saisir 6°C → conforme = false + alerte visible immédiatement
  - [ ] Tenter UPDATE sur temperature_logs → erreur PostgreSQL (RLS bloque)
  - [ ] Tenter DELETE sur temperature_logs → erreur PostgreSQL (RLS bloque)
  - [ ] Historique graphique des 7 derniers jours
- **Testing**:
  - [ ] pgTAP: INSERT température OK / UPDATE → rejected / DELETE → rejected
  - [ ] Vitest: `saveTemperatureLog` → vérifie INSERT, jamais UPDATE
  - [ ] Playwright: saisie 6°C → alerte rouge visible < 1s
  - [ ] Playwright iPhone 14: saisie en 2 taps (< 5s end-to-end)
- **Skills**: `pms-haccp-france`, `supabase-rls-multitenant`

---

### Task 5.2: Checklists Nettoyage
- **Objectif**: Checklists pré-service, post-service, hebdomadaire, mensuelle — saisie rapide, immuables après validation.
- **Dépendances**: 5.1
- **Bloqué par**: Task 5.1
- **Fichiers**:
  - `server/routers/pms.ts` → `pms.getChecklists`, `pms.saveChecklistCompletion`
  - `app/(app)/pms/checklists/page.tsx`
  - `components/pms/Checklist.tsx` (items avec case à cocher + note optionnelle)
  - `supabase/seed.sql` → checklists par défaut (pré-service 5 items, post-service 5 items)
- **Contracts**:
  - Checklists par défaut seedées à la création du restaurant
  - `pms.saveChecklistCompletion({ checklist_id, items_valides: [{ id, valide, note? }] })` → INSERT UNIQUEMENT
  - Completion enregistrée avec `auteur_id`, `date`, `duree_minutes`
  - AUCUNE politique UPDATE ni DELETE sur `nettoyage_completions`
  - Checklist du jour affichée en premier, avec indicateur complété/non-complété
- **Acceptance Criteria**:
  - [ ] Checklist pré-service : 5 items, validation rapide (< 60s)
  - [ ] Après validation → checklist marquée "Complète" pour la journée
  - [ ] Historique des 30 derniers jours visible
  - [ ] Tenter modifier une completion passée → impossible (RLS)
- **Testing**:
  - [ ] pgTAP: INSERT completion OK / UPDATE → rejected
  - [ ] Playwright: valider checklist pré-service → vérifier statut "Complète"
  - [ ] Playwright iPhone 14: valider checklist en < 60s
- **Skills**: `pms-haccp-france`, `supabase-rls-multitenant`

---

### Task 5.3: Réceptions Marchandises
- **Objectif**: Enregistrement des réceptions fournisseurs (liées à l'OCR factures ou manuelle) — DLC, numéros lot, température réception.
- **Dépendances**: 3.2, 5.1
- **Bloqué par**: Tasks 3.2 + 5.1
- **Fichiers**:
  - `server/routers/pms.ts` → `pms.createReception`, `pms.getReceptions`
  - `app/(app)/pms/receptions/page.tsx`
  - `components/pms/ReceptionForm.tsx` (pré-rempli depuis OCR si disponible)
- **Contracts**:
  - `pms.createReception({ fournisseur_id, items: [{ ingredient_id, quantite, dlc, numero_lot, temperature_reception, conforme }] })`
  - Si `conforme = false` → `anomalie_description` obligatoire
  - `statut`: `'conforme' | 'anomalie' | 'refuse'`
  - Lié à `receptions` + `reception_items` (pour traçabilité viande bovine 5 ans)
  - Intégration: après OCR facture (Task 3.2) → pré-remplir formulaire réception
- **Acceptance Criteria**:
  - [ ] Créer une réception avec 3 produits, numéros lot et DLC
  - [ ] DLC d'hier → alerte visible (couleur rouge)
  - [ ] Réception non-conforme → champ action corrective obligatoire
  - [ ] Historique des réceptions filtrable par fournisseur
- **Testing**:
  - [ ] Vitest: DLC passée → alerte générée
  - [ ] Playwright: créer réception non-conforme → vérifier champ action corrective visible
  - [ ] pgTAP: isolation réceptions entre restaurants
- **Skills**: `pms-haccp-france`, `supabase-rls-multitenant`

---

### Task 5.4: HACCP Auto-génération (Claude Haiku)
- **Objectif**: Génération du plan HACCP à la demande ("Générer mon plan HACCP") depuis les fiches techniques existantes.
- **Dépendances**: 2.3
- **Bloqué par**: Task 2.3 (fiches techniques créées)
- **Fichiers**:
  - `lib/ai/haccp-generator.ts` (Claude Haiku 4.5 avec prompt caching)
  - `server/routers/pms.ts` → `pms.generateHACCP`
  - `app/(app)/pms/haccp/page.tsx`
  - `components/pms/HACCPDisplay.tsx`
- **Contracts**:
  - Déclenché UNIQUEMENT via bouton "Générer mon plan HACCP" (D7 DISCOVERY.md)
  - Claude analyse les fiches techniques (plats + ingrédients + allergènes)
  - Output: liste de `haccp_points_critiques` par plat (danger, CCP, température critique, action corrective)
  - INSERT dans `haccp_points_critiques` après génération
  - Bloquer si < 3 plats créés (D29 DISCOVERY.md)
- **Acceptance Criteria**:
  - [ ] Bouton HACCP visible après 3+ plats créés
  - [ ] Génération HACCP en < 30s pour 5 plats
  - [ ] Points critiques pertinents identifiés (ex: cuisson volaille → 74°C)
  - [ ] Plan HACCP sauvegardé et consultable
  - [ ] Régénérer → remplace les points précédents
- **Testing**:
  - [ ] Vitest: mock Anthropic → vérifier INSERT dans haccp_points_critiques
  - [ ] Playwright: 3 plats créés → bouton HACCP cliquable → génération
  - [ ] Playwright: 2 plats → bouton HACCP grisé
- **Skills**: `pms-haccp-france`

---

### Task 5.5: RappelConso — Cron + Alertes
- **Objectif**: Cron quotidien 21h00 — fetch API RappelConso, matching avec la mercuriale, alerte push + email si match.
- **Dépendances**: 3.1
- **Bloqué par**: Task 3.1 (mercuriale créée)
- **Fichiers**:
  - `app/api/cron/rappelconso/route.ts` (cron Vercel 21h)
  - `lib/rappelconso.ts` (fetch API + matching)
  - `vercel.json` (cron schedule)
  - `server/routers/pms.ts` → `pms.getRappelAlerts`, `pms.markRappelTraite`
  - `app/(app)/pms/rappels/page.tsx`
- **Contracts**:
  - Endpoint: `GET https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records`
  - Cron secret: `Authorization: Bearer ${CRON_SECRET}`
  - Matching: `nom_produit_rappele ILIKE %nom_ingrédient%` OU `nom_marque_produit ILIKE %nom_ingrédient%`
  - UPSERT dans `rappel_alerts` avec `onConflict: 'restaurant_id, rappelconso_id'`
  - Après match → send push notification + email (fallback si push non disponible)
  - Heartbeat BetterUptime en fin de cron
  - Cache Upstash: résultats API cachés 24h
- **Acceptance Criteria**:
  - [ ] Cron `GET /api/cron/rappelconso` s'exécute sans erreur (secret valide)
  - [ ] Un rappel dont le nom correspond à un ingrédient → `rappel_alerts` créé + push envoyé
  - [ ] UPSERT correct (pas de doublon si cron relancé)
  - [ ] Heartbeat BetterUptime ping reçu après exécution
  - [ ] UI: liste des alertes avec action "Marquer comme traité"
- **Testing**:
  - [ ] Vitest: mock API RappelConso + mercuriale → vérifier INSERT rappel_alerts
  - [ ] Vitest: cron sans secret → 401
  - [ ] curl `/api/cron/rappelconso` avec CRON_SECRET → status 200 + `{ processed: N }`
  - [ ] Vérifier BetterUptime dashboard: heartbeat reçu
- **Skills**: `rappelconso-integration`, `pms-haccp-france`

---

### Task 5.6: Export DDPP — PDF Complet
- **Objectif**: Génération PDF export DDPP couvrant 12 mois glissants (températures + checklists + réceptions + plan HACCP + formations).
- **Dépendances**: 5.1, 5.2, 5.3, 5.4
- **Bloqué par**: Tasks 5.1 à 5.4
- **Fichiers**:
  - `components/pdf/DDPPExport.tsx` (@react-pdf/renderer)
  - Mis à jour `app/api/generate-pdf/route.ts` → type `'ddpp-export'`
  - `server/routers/pms.ts` → `pms.getDDPPData({ mois?: number })` (12 mois par défaut)
  - `app/(app)/pms/export/page.tsx`
- **Contracts**:
  - `export const runtime = 'nodejs'` OBLIGATOIRE dans generate-pdf/route.ts
  - PDF inclut: en-tête restaurant, période, relevés T°, checklists, réceptions, HACCP, formations hygiène
  - Génération < 5s pour 12 mois de données (objectif DISCOVERY.md)
  - Format A4, numérotation pages, horodatage sur chaque section
  - Mode contrôle sanitaire: bouton "Mode Inspecteur" → déclenche génération immédiate
- **Acceptance Criteria**:
  - [ ] PDF généré en < 5s (12 mois de données simulées)
  - [ ] PDF contient toutes les sections requises (T°, checklists, réceptions, HACCP)
  - [ ] "Mode Inspecteur" : accès en 1 tap → PDF téléchargé en < 10s
  - [ ] Période paramétrable (1-12 mois)
- **Testing**:
  - [ ] Playwright: cliquer "Mode Inspecteur" → mesurer temps téléchargement (< 10s)
  - [ ] Vitest: renderToBuffer avec données mock → buffer non vide > 10KB
  - [ ] Vérifier runtime Node.js (pas Edge) dans les headers Vercel response
- **Skills**: `whatsapp-pdf-export`, `pms-haccp-france`

---

### Task 5.7: Offline PWA + Background Sync PMS
- **Objectif**: Service Worker custom pour queue offline des saisies PMS (températures + checklists) — sync automatique au retour réseau.
- **Dépendances**: 5.1, 5.2
- **Bloqué par**: Tasks 5.1 + 5.2
- **Fichiers**:
  - `public/sw-custom.js` (Service Worker + IndexedDB queue + Background Sync)
  - `lib/pms-offline.ts` (queuePMSRecord côté client)
  - `components/pms/OfflineBadge.tsx` (indicateur de queue offline)
  - Mis à jour `next.config.ts` → enregistrement sw-custom.js
- **Contracts**:
  - Intercepte les appels vers: `pms.saveTemperatureLog`, `pms.saveChecklistCompletion`
  - Si réseau indisponible → stocke dans IndexedDB (`mise-en-place-sync` DB, `pms-queue` store)
  - Background Sync tag: `'pms-sync'`
  - Au retour réseau → flush queue → retry les appels tRPC
  - UI: badge "X relevés en attente de synchronisation"
  - Supabase offline si pas de réseau → ne pas crasher, retourner `{ queued: true }`
- **Acceptance Criteria**:
  - [ ] Couper le réseau (Playwright `context.setOffline(true)`) → saisir température → badge "1 relevé en attente"
  - [ ] Rétablir réseau → badge disparaît → relevé présent en BDD
  - [ ] Test iOS: Service Worker enregistré sur Safari (Playwright webkit)
  - [ ] Pas de perte de données après rechargement de page en mode offline
- **Testing**:
  - [ ] Playwright: `context.setOffline(true)` → saisir température → `setOffline(false)` → vérifier BDD
  - [ ] Playwright: vérifier badge OfflineBadge visible en mode offline
  - [ ] Playwright webkit: Service Worker enregistré (vérifier via `page.evaluate(() => navigator.serviceWorker.ready)`)
- **Skills**: `nextjs-pwa-mobile`, `pms-haccp-france`

---

### Task 5.R: Régression Phase 5
- **Objectif**: Validation complète du module PMS.
- **Dépendances**: Toutes les tâches Phase 5 complètes
- **Testing**:
  - [ ] Playwright iPhone 14: relevé T° en 2 taps → conforme → historique affiché
  - [ ] Playwright: T° hors plage → alerte immédiate rouge
  - [ ] Playwright: mode offline → relevé → retour réseau → sync automatique
  - [ ] Playwright: "Mode Inspecteur" → PDF téléchargé en < 10s
  - [ ] pgTAP: temperature_logs immuable (UPDATE/DELETE rejected)
  - [ ] pgTAP: nettoyage_completions immuable
  - [ ] curl cron rappelconso → 200 + heartbeat BetterUptime
  - [ ] Screenshots: tableau bord PMS + historique T° + export DDPP

---

## Phase 6: Finitions — Onboarding, PWA Complète & Seed

**Objectif**: Onboarding progressif 3 jours, PWA manifest complet, notifications push VAPID, seed catalogue 500 ingrédients.

### Task 6.1: Onboarding Progressif 3 Jours
- **Objectif**: Flow d'onboarding selon D28 DISCOVERY.md — Jour 1 (2 min : type établissement + photo plat), Jour 2 (notification prix), Jour 3 (notification commande).
- **Dépendances**: 2.1, 4.1
- **Bloqué par**: Tasks 2.1 + 4.1
- **Fichiers**:
  - `app/(app)/onboarding/page.tsx` (étape 1: type établissement)
  - `app/(app)/onboarding/plat/page.tsx` (étape 2: photo + validation IA)
  - `app/(app)/onboarding/done/page.tsx`
  - `server/routers/dashboard.ts` → `dashboard.getOnboardingStatus`
  - `components/onboarding/OnboardingProgress.tsx`
  - `app/api/cron/onboarding-notifications/route.ts` (notifications J2, J3)
  - Mis à jour `vercel.json` → cron onboarding
- **Contracts**:
  - Jour 1 < 2 min : type établissement (select) → photo plat → validation IA → done
  - Pas de saisie mercuriale/commandes obligatoire en J1
  - J2 à 10h : notification push "Ajoutez vos prix pour voir votre food cost"
  - J3 à 10h : notification push "Générez votre premier bon de commande"
  - L'app fonctionne normalement pendant l'onboarding (données incomplètes OK)
  - `restaurants.parametres.onboarding_completed_at` mis à jour à la fin J1
- **Acceptance Criteria**:
  - [ ] Onboarding J1 complet en < 2 minutes (Playwright timer)
  - [ ] Après onboarding → redirect vers dashboard (pas un écran bloquant)
  - [ ] Cron onboarding J2/J3 s'exécute (vérifier log)
  - [ ] Utilisateur sans photo de plat → onboarding accessible depuis dashboard
- **Testing**:
  - [ ] Playwright: mesurer durée onboarding J1 (< 120s)
  - [ ] Playwright: après onboarding → dashboard accessible immédiatement
  - [ ] curl cron onboarding → 200
- **Skills**: `nextjs-pwa-mobile`

---

### Task 6.2: PWA Manifest + Service Worker Complet
- **Objectif**: PWA installable sur iPhone et Android avec manifest complet, icônes, share target, mode offline partiel.
- **Dépendances**: 1.1
- **Bloqué par**: Task 1.1
- **Fichiers**:
  - `public/manifest.json` (complet avec screenshots, share_target)
  - `public/icons/icon-192.png` + `icon-512.png` (icônes générées)
  - `public/screenshots/dashboard.png` (screenshot pour manifest)
  - Mis à jour `next.config.ts` → PWA activé en production (désactivé en dev)
  - Mis à jour `app/layout.tsx` → meta tags iOS complets
  - `components/IOSInstallPrompt.tsx`
- **Contracts**:
  - `display: "standalone"` dans manifest
  - `share_target`: permet de partager une image → `/plats/nouveau` (analyse auto)
  - Meta iOS: `apple-mobile-web-app-capable: yes`, status bar style black-translucent
  - Safe area: `viewport-fit=cover` + `env(safe-area-inset-*)` dans le CSS
  - IOSInstallPrompt: affiché sur iOS si non installé + non dismissed
- **Acceptance Criteria**:
  - [ ] Chrome "Installer l'application" disponible (Lighthouse PWA score ≥ 90)
  - [ ] Sur iOS: prompt d'installation affiché
  - [ ] App installée → démarre en mode standalone (pas de barre Safari)
  - [ ] Share target: partager photo depuis galerie → ouvre l'app sur /plats/nouveau
- **Testing**:
  - [ ] Playwright: vérifier manifest.json accessible + contenu valide
  - [ ] Lighthouse audit: PWA score ≥ 90
  - [ ] Playwright webkit (iPhone 14): meta tags iOS présents dans le HTML
- **Skills**: `nextjs-pwa-mobile`

---

### Task 6.3: Push Notifications VAPID
- **Objectif**: Notifications push Web (VAPID) pour reminders PMS et alertes rappel produit. Fallback email si iOS non installé.
- **Dépendances**: 6.2, 5.5
- **Bloqué par**: Tasks 6.2 + 5.5
- **Fichiers**:
  - `app/api/push/subscribe/route.ts`
  - `lib/push-notifications.ts` (sendPMSReminder, sendRappelAlert)
  - `supabase/migrations/...push_subscriptions.sql` (table push_subscriptions)
  - `components/pms/PushPermissionPrompt.tsx`
  - Mis à jour crons températures + rappelconso → envoi push
- **Contracts**:
  - VAPID keys: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` en env
  - Table `push_subscriptions`: `{ user_id, restaurant_id, subscription JSONB }`
  - Notification PMS: `{ title: 'Mise en Place', body: 'Relevé température requis', data: { url: '/pms/temperatures' } }`
  - iOS: uniquement si PWA installée (Playwright webkit ne peut pas tester → documenter limitation)
  - Fallback: si `push_subscriptions` vide pour un restaurant → Resend email
- **Acceptance Criteria**:
  - [ ] Navigateur accepte la permission push
  - [ ] Subscription stockée dans Supabase
  - [ ] Notification reçue en navigateur (Playwright evaluate pour mock push)
  - [ ] Si pas de subscription → email Resend envoyé (vérifier Resend dashboard)
- **Testing**:
  - [ ] Playwright: vérifier endpoint `/api/push/subscribe` accepte subscription JSON
  - [ ] Vitest: sendPMSReminder avec mock webpush → vérifie sendNotification appelé
  - [ ] Vitest: pas de subscription → email Resend appelé
- **Skills**: `nextjs-pwa-mobile`

---

### Task 6.4: Seed Catalogue Ingrédients (500 items)
- **Objectif**: Peupler `ingredients_catalog` avec 500 ingrédients courants de restauration depuis Open Food Facts + liste curatée.
- **Dépendances**: 1.2
- **Bloqué par**: Task 1.2
- **Fichiers**:
  - `scripts/seed-ingredients-catalog.ts` (script de seed)
  - `supabase/seed.sql` (données finales en SQL)
  - `data/ingredients-catalog.json` (liste curatée + Open Food Facts)
- **Contracts**:
  - ≥ 500 ingrédients avec: `nom`, `categorie`, `allergenes`, `kcal_par_100g`, `unite_standard`
  - Catégories: viande, poisson, légume, féculent, sauce, fromage, laitage, fruit, épice, autre
  - Allergènes mappés selon format app (14 codes: gluten, lait, oeufs...)
  - Index full-text `search_vector` généré automatiquement (GENERATED ALWAYS AS)
  - Recherche "beurre" → ≥ 3 résultats en < 200ms
- **Acceptance Criteria**:
  - [ ] `supabase db reset` → 500+ ingrédients dans `ingredients_catalog`
  - [ ] Recherche "beurre" retourne ≥ 3 résultats
  - [ ] Recherche "escalope" retourne ≥ 2 résultats
  - [ ] Allergènes corrects pour "lait entier" → `['lait']`
- **Testing**:
  - [ ] SQL: `SELECT count(*) FROM ingredients_catalog` ≥ 500
  - [ ] SQL: `SELECT * FROM search_ingredients('beurre', null, 10)` → ≥ 3 résultats
  - [ ] Playwright: recherche "beurre" dans formulaire fiche technique → suggestions < 200ms
- **Skills**: `mise-en-place-architecture`, `supabase-rls-multitenant`

---

### Task 6.R: Régression Phase 6
- **Objectif**: Validation onboarding + PWA + notifications + catalogue.
- **Dépendances**: Toutes les tâches Phase 6 complètes
- **Testing**:
  - [ ] Playwright: onboarding J1 complet en < 2 min sur iPhone 14 (Webkit)
  - [ ] Lighthouse PWA audit: score ≥ 90
  - [ ] Playwright: recherche ingrédient → suggestions en < 200ms
  - [ ] Playwright: souscrire aux notifications push → subscription en BDD
  - [ ] SQL: count ingredients_catalog ≥ 500
  - [ ] Screenshots: onboarding + dashboard post-onboarding

---

## Phase 7: CI/CD Complet & Monitoring

**Objectif**: Pipeline CI/CD robuste, monitoring production opérationnel, déploiement Vercel production.

### Task 7.1: GitHub Actions — Pipeline Complet
- **Objectif**: Pipeline CI/CD complet : quality → unit → integration → e2e preview → deploy production.
- **Dépendances**: 1.6
- **Bloqué par**: Task 1.6
- **Fichiers**:
  - `.github/workflows/ci.yml` (pipeline complet avec tous les jobs)
  - `.github/workflows/deploy-prod.yml` (deploy prod sur merge main)
  - `tests/e2e/auth.spec.ts`
  - `tests/e2e/dish-photo-flow.spec.ts`
  - `tests/e2e/pms-offline.spec.ts`
  - `tests/e2e/commandes-flow.spec.ts`
  - `tests/fixtures/dish-steak.jpg` (image test plat)
  - `tests/fixtures/invoice-sample.jpg` (image test facture)
- **Contracts**:
  - Job quality: typecheck + lint + prettier → bloque si erreur
  - Job unit-tests: `vitest run` avec coverage ≥ 80%
  - Job integration-tests: Supabase local + migrations + pgTAP
  - Job e2e: Vercel preview + Playwright (iPhone 14 + Desktop Chrome)
  - Job deploy-prod: migrations + vercel --prod + smoke test /api/health
  - Secrets GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_DB_URL`, `CRON_SECRET`
- **Acceptance Criteria**:
  - [ ] PR → tous les jobs verts → deploy preview avec URL Vercel
  - [ ] Merge main → deploy production automatique
  - [ ] Coverage rapport uploadé (Codecov ou équivalent)
  - [ ] E2E tests : flux photo + PMS offline verts
  - [ ] Smoke test production : /api/health → 200
- **Testing**:
  - [ ] Ouvrir une PR test → vérifier tous les jobs GitHub Actions verts
  - [ ] Merge vers main → vérifier déploiement production automatique
  - [ ] Vérifier smoke test /api/health post-deploy
- **Skills**: `mise-en-place-architecture`

---

### Task 7.2: Sentry + PostHog
- **Objectif**: Monitoring erreurs (Sentry) + analytics RGPD-friendly (PostHog EU) opérationnels en production.
- **Dépendances**: 7.1
- **Bloqué par**: Task 7.1
- **Fichiers**:
  - `sentry.client.config.ts`
  - `sentry.server.config.ts`
  - `next.config.ts` → withSentryConfig
  - `lib/posthog.ts`
  - `components/PostHogProvider.tsx`
  - `app/layout.tsx` → PostHogProvider
- **Contracts**:
  - Sentry DSN configuré pour prod/staging (différents projets)
  - `tracesSampleRate: 0.1` (10% transactions)
  - PostHog host: `https://eu.i.posthog.com` (EU RGPD)
  - Events à tracker: `dish_photo_analyzed`, `fiche_technique_saved`, `bon_commande_generated`, `temperature_logged`, `ddpp_export_generated`
  - Sentry: masquer données sensibles (`maskAllText: true` dans replay)
- **Acceptance Criteria**:
  - [ ] Déclencher une erreur test → apparaît dans Sentry dashboard < 30s
  - [ ] Event PostHog visible dans dashboard EU PostHog
  - [ ] Aucune donnée PII dans les payloads PostHog
- **Testing**:
  - [ ] Playwright: déclencher route avec `throw new Error('test-sentry')` → vérifier Sentry dashboard
  - [ ] Playwright: créer une fiche technique → vérifier event PostHog `fiche_technique_saved`
  - [ ] Vérifier logs Vercel: aucune erreur 500 en production
- **Skills**: `mise-en-place-architecture`

---

### Task 7.3: BetterUptime + Crons Vercel
- **Objectif**: BetterUptime configuré pour monitoring uptime + heartbeats crons PMS/RappelConso. Tous les crons Vercel configurés.
- **Dépendances**: 5.5, 5.1
- **Bloqué par**: Tasks 5.5 + 5.1
- **Fichiers**:
  - `vercel.json` (crons complets: rappelconso 21h, temperatures 7h + 17h, onboarding)
  - `app/api/cron/temperature-reminders/route.ts` (cron 7h + 17h)
  - Mis à jour tous les crons → ping BetterUptime heartbeat en fin d'exécution
- **Contracts**:
  - Crons Vercel: rappelconso (21h), temperature-reminders (7h + 17h), onboarding-notifications (10h)
  - BetterUptime monitors:
    - Uptime check: `/api/health` toutes les 2 min → alerte si DOWN > 2 min
    - Heartbeat cron rappelconso: si pas de ping en 26h → alerte
    - Heartbeat cron temperatures: si pas de ping en 26h → alerte
  - Alertes BetterUptime: email + Slack (si disponible)
- **Acceptance Criteria**:
  - [ ] `/api/health` monitoré sur BetterUptime
  - [ ] Heartbeat reçu après chaque exécution cron
  - [ ] Couper app 3 min → alerte BetterUptime reçue
- **Testing**:
  - [ ] curl tous les crons avec CRON_SECRET → 200 + log heartbeat
  - [ ] Vérifier BetterUptime dashboard: todos les monitors verts
  - [ ] Vérifier Vercel logs: crons listés + schedules corrects
- **Skills**: `rappelconso-integration`, `pms-haccp-france`

---

### Task 7.4: pgTAP — Tests RLS Complets
- **Objectif**: Suite de tests pgTAP vérifiant l'isolation RLS sur toutes les tables critiques.
- **Dépendances**: 1.2
- **Bloqué par**: Task 1.2
- **Fichiers**:
  - `supabase/tests/rls_isolation.test.sql`
  - `supabase/tests/rls_immutability.test.sql`
  - `supabase/tests/rls_storage.test.sql`
- **Contracts**:
  - Test isolation: 2 restaurants, 2 users → chaque user ne voit QUE ses données
  - Tables testées: plats, fiches_technique, mercuriale, bons_de_commande, ventes, temperature_logs, nettoyage_completions, receptions, rappel_alerts, events
  - Test immuabilité: UPDATE sur temperature_logs → rejeté / DELETE → rejeté
  - Test immuabilité: UPDATE sur nettoyage_completions → rejeté
  - Tests dans CI: `supabase test db` dans job integration-tests
- **Acceptance Criteria**:
  - [ ] `supabase test db` → 100% tests verts
  - [ ] 0 fuite de données inter-restaurant sur toutes les tables
  - [ ] Immuabilité confirmée sur temperature_logs + nettoyage_completions
- **Testing**:
  - [ ] `supabase test db` → tous les tests pgTAP passent
  - [ ] Intégré dans GitHub Actions job integration-tests
- **Skills**: `supabase-rls-multitenant`

---

### Task 7.5: Déploiement Vercel Production
- **Objectif**: Application déployée en production sur Vercel avec Supabase Cloud EU, variables d'environnement configurées, domaine custom (si disponible).
- **Dépendances**: Toutes les phases précédentes
- **Bloqué par**: Toutes phases précédentes
- **Fichiers**:
  - Configuration Vercel project (via CLI)
  - `.env.production` (variables prod — NON committé, configuré dans Vercel dashboard)
  - Supabase project production créé
- **Contracts**:
  - Région Vercel: `fra1` (Frankfurt)
  - Supabase Cloud EU: Frankfurt
  - Variables env production configurées dans Vercel dashboard (pas dans git)
  - Migration production: `supabase db push --db-url $PROD_DB_URL` via CI
  - URL: `app.miseenplace.fr` si domaine acheté, sinon `projet.vercel.app`
- **Acceptance Criteria**:
  - [ ] App accessible en production HTTPS
  - [ ] `/api/health` → 200 en production
  - [ ] Auth fonctionne en production
  - [ ] RLS active en production (test avec 2 comptes)
  - [ ] Crons Vercel listés dans dashboard Vercel
- **Testing**:
  - [ ] Playwright: URL production — register → login → dashboard
  - [ ] curl `https://prod-url/api/health` → 200
  - [ ] Vérifier Vercel dashboard: crons actifs
  - [ ] Sentry: aucune erreur au démarrage
- **Skills**: `mise-en-place-architecture`

---

### Task 7.R: Régression Phase 7
- **Objectif**: Validation complète CI/CD et monitoring.
- **Dépendances**: Toutes les tâches Phase 7 complètes
- **Testing**:
  - [ ] Ouvrir une PR → pipeline CI complète verte (quality + unit + integration + e2e + deploy preview)
  - [ ] `supabase test db` → 100% pgTAP verts
  - [ ] BetterUptime: tous monitors verts
  - [ ] Sentry: dashboard propre (0 issues non résolues)
  - [ ] Production: flux complet photo → fiche → commande → PMS
  - [ ] Screenshots: Vercel dashboard + BetterUptime + Sentry

---

## Phase 8: E2E Testing & Préparation Beta

**Objectif**: Tests end-to-end complets sur production, validation performance, préparation pour les 3-4 beta testeurs.

### Task 8.1: Tests Playwright Complets — Tous les Flux Utilisateur
- **Objectif**: Suite de tests Playwright exhaustive couvrant tous les parcours utilisateurs en mobile (iPhone 14 Safari) et desktop.
- **Dépendances**: Toutes phases précédentes
- **Fichiers**:
  - `tests/e2e/onboarding-complete.spec.ts`
  - `tests/e2e/dish-full-flow.spec.ts` (photo → fiche → allergènes → coût)
  - `tests/e2e/commande-full-flow.spec.ts` (mercuriale → bon → WhatsApp)
  - `tests/e2e/pms-full-flow.spec.ts` (températures → checklists → HACCP → export DDPP)
  - `tests/e2e/pms-offline.spec.ts` (Background Sync)
  - `tests/e2e/rls-isolation.spec.ts` (isolation inter-restaurant)
- **Acceptance Criteria**:
  - [ ] Tous les tests E2E verts sur iPhone 14 (Playwright webkit)
  - [ ] Tous les tests E2E verts sur Desktop Chrome
  - [ ] Aucun test > 30s (timeout réaliste)
  - [ ] Tests offline PMS verts
  - [ ] 0 régression sur tous les flux précédents
- **Testing**:
  - [ ] `npx playwright test --project="iPhone 14 Safari"` → 0 échec
  - [ ] `npx playwright test --project="Desktop Chrome"` → 0 échec
  - [ ] Screenshots/vidéos des flux clés comme documentation
- **Skills**: `mise-en-place-architecture`, `nextjs-pwa-mobile`

---

### Task 8.2: Tests Performance
- **Objectif**: Vérification des objectifs de performance définis dans DISCOVERY.md.
- **Dépendances**: 8.1
- **Fichiers**:
  - `tests/e2e/performance.spec.ts`
- **Cibles**:
  - Analyse photo (Gemini): < 5s (objectif DISCOVERY: < 3s en prod optimisée)
  - Dashboard chargement: < 1s
  - Export DDPP PDF: < 5s (12 mois données)
  - Recherche ingrédients: < 200ms
  - Analyse WhatsApp: < 2s pour générer et envoyer
- **Acceptance Criteria**:
  - [ ] Dashboard < 1s mesuré avec `page.evaluate(() => performance.timing)`
  - [ ] Recherche ingrédients < 200ms (Playwright)
  - [ ] Export PDF < 5s (Playwright network timing)
  - [ ] Analyse photo < 5s end-to-end (upload + Gemini + affichage)
- **Testing**:
  - [ ] Playwright: mesurer temps dashboard (Navigation Timing API)
  - [ ] Playwright: mesurer temps recherche ingrédients
  - [ ] Playwright: mesurer temps export PDF
- **Skills**: `mise-en-place-architecture`

---

### Task 8.3: Validation RLS + Sécurité Finale
- **Objectif**: Vérification finale de l'isolation des données et de la sécurité — aucune fuite inter-restaurant possible.
- **Dépendances**: 7.4
- **Fichiers**:
  - `tests/e2e/rls-isolation.spec.ts` (tests Playwright avec 2 comptes différents)
- **Acceptance Criteria**:
  - [ ] Compte A ne peut pas accéder aux données de compte B (Playwright — 2 contextes browser)
  - [ ] Tentative d'accès direct à un `plat_id` d'un autre restaurant → 0 résultats (pas 401, RLS silencieux)
  - [ ] `supabase test db` (pgTAP) → 100% verts
  - [ ] Aucune variable d'environnement sensible exposée côté client (vérification `NEXT_PUBLIC_*`)
- **Testing**:
  - [ ] Playwright: 2 comptes → compte A crée plat → compte B ne le voit pas
  - [ ] `supabase test db` → 100% pgTAP
  - [ ] Grep code source: aucun `SUPABASE_SERVICE_ROLE_KEY` dans `NEXT_PUBLIC_*`
- **Skills**: `supabase-rls-multitenant`

---

### Task 8.4: Préparation Beta + Onboarding Testeurs
- **Objectif**: Guide d'onboarding beta testeurs, comptes créés, données de démonstration, procédure de feedback.
- **Dépendances**: 8.1, 8.2, 8.3
- **Fichiers**:
  - `docs/beta-onboarding.md` (guide testeur — comment utiliser l'app)
  - `scripts/create-beta-accounts.ts` (création comptes + données demo)
  - `supabase/seed-demo.sql` (données de démonstration réalistes — 5 plats, 3 fournisseurs, 7j de températures)
- **Acceptance Criteria**:
  - [ ] 3-4 comptes beta créés avec données de démonstration
  - [ ] Chaque testeur peut se connecter et voir un restaurant pré-configuré
  - [ ] Guide beta clair (< 1 page) expliquant les 3 flux principaux à tester
  - [ ] Procédure de feedback définie (email, WhatsApp, ou formulaire simple)
  - [ ] App stable sur iPhone de chaque testeur (tester sur vrai iPhone si possible)
- **Testing**:
  - [ ] Se connecter avec chaque compte beta → dashboard visible avec données demo
  - [ ] Flux onboarding J1 avec un "nouveau" compte → < 2 min
  - [ ] Vérifier que l'app s'installe sur iPhone (via guide d'installation)
- **Skills**: `nextjs-pwa-mobile`

---

## Dependency Graph

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.R
                    ↓
              2.1 → 2.2 → 2.3 → 2.5
              ↓           ↓
              2.4    3.1 → 3.2 → 3.3 → 3.4 → 3.R
                     ↓
                4.1 → 4.2 → 4.3 → 4.R
                          ↓
              5.1 → 5.2 ↗
              5.1 → 5.3 ← 3.2
              5.1 → 5.7
              2.3 → 5.4
              3.1 → 5.5
              5.1+5.2+5.3+5.4 → 5.6 → 5.R
                    ↓
              6.1 (dépend 2.1, 4.1)
              6.2 → 6.3 (dépend 5.5)
              1.2 → 6.4
              → 6.R
                    ↓
              1.6 → 7.1
              7.1 → 7.2 → 7.R
              5.5 → 7.3
              1.2 → 7.4
              all  → 7.5 → 7.R
                    ↓
              7.R → 8.1 → 8.2 → 8.3 → 8.4
```

---

## Task Execution Protocol

### Pour chaque tâche :
1. **Orienter**: Lire le fichier de tâche + skills pertinents + PROGRESS.md
2. **Explorer**: Lire les fichiers existants du projet avant d'écrire une ligne
3. **Planifier**: Plan d'implémentation concis avant de coder
4. **Implémenter**: Branch feature, écrire code + tests
5. **Tester**: Exécuter tous les types de tests applicables localement
6. **Valider**: TypeCheck + lint doivent passer
7. **Terminer**: Mettre à jour PROGRESS.md, commit, merge vers develop

### Pour les tâches de régression :
1. Déployer sur Vercel preview/staging
2. Exécuter tous les tests de la phase
3. Tests Playwright E2E sur URL déployée (pas localhost)
4. Corriger les échecs avant de considérer la phase terminée
5. Merger phase branch vers develop/main

### Pour la Phase 8 (finale) :
1. Tous les tests sur URL de production
2. Tests sur vrai iPhone (au moins 1 testeur)
3. Itérer sur main jusqu'à 0 bug bloquant
4. Critère de succès beta : 7/10 testeurs actifs semaine 2, NPS > 30

---

## Variables d'Environnement Requises

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=

# AI
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Notifications
RESEND_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Monitoring
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
BETTERUPTIME_HEARTBEAT_URL=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
REQUIRE_PAYMENT_METHOD=false

# Feature flags
# STRIPE_* = uniquement phase commercialisation
```
