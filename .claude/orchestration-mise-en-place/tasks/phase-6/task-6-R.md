# Task 6.R: Régression Phase 6 — Finitions

## Objective
Validation complète onboarding + PWA + notifications push + catalogue ingrédients sur Vercel preview.

## Context
Phase 6 = finitions qui complètent l'expérience utilisateur. Les tests de régression valident que l'onboarding fonctionne sur un vrai iPhone, que le score Lighthouse PWA est suffisant, et que le catalogue permet une recherche rapide.

## Dependencies
- Toutes les tâches Phase 6 complètes (6.1 → 6.4)

## Blocked By
- Tasks 6.1 → 6.4 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
git checkout develop
git merge phase-6/finitions
git push origin develop
```

### Step 2: Test Onboarding J1

```
1. Créer un nouveau compte sur $PREVIEW_URL/register
2. Démarrer timer
3. Sur /onboarding:
   - Sélectionner "Restaurant"
   - Cliquer "Continuer →"
4. Sur /onboarding/plat:
   - Cliquer "Passer cette étape pour l'instant"
5. Sur /onboarding/done:
   - Attendre redirection automatique (3s) → /dashboard
6. Arrêter timer → doit être < 120s
7. Vérifier: OnboardingProgress visible sur dashboard avec 0/4 étapes
```

### Step 3: Test PWA Manifest

```bash
# Vérifier manifest.json
curl "$PREVIEW_URL/manifest.json" | jq '.display, .share_target'
# Attendu: "standalone" + share_target défini

# Lighthouse audit
npx lighthouse "$PREVIEW_URL" --only-categories=pwa --output=json
# Attendu: score PWA ≥ 90
```

### Step 4: Test iOS — Playwright webkit

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pwa.spec.ts --project="iPhone 14 Safari"
```

Vérifications manuelles sur iPhone réel (si possible) :
```
1. iPhone: Safari → $PREVIEW_URL
2. Vérifier: prompt IOSInstallPrompt visible
3. Installer l'app (Share → Sur l'écran d'accueil)
4. Ouvrir depuis l'écran d'accueil → mode standalone (pas de barre URL Safari)
5. Tester l'onboarding installé
```

### Step 5: Test Notifications Push

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pwa.spec.ts --project="Desktop Chrome"
```

Test manuel navigateur :
```
1. Sur $PREVIEW_URL/pms/temperatures
2. Cliquer "Activer les notifications" (PushPermissionPrompt)
3. Accepter la permission
4. Vérifier: subscription dans Supabase dashboard → push_subscriptions
5. curl cron temperature-reminders → vérifier log "Push envoyé"
```

### Step 6: Test Catalogue Ingrédients

```bash
# Vérifier count
psql $STAGING_DB_URL -c "SELECT count(*) FROM ingredients_catalog;"
# Attendu: ≥ 500

# Test recherche
psql $STAGING_DB_URL -c "SELECT nom FROM search_ingredients('beurre', NULL, 5);"
# Attendu: beurre doux, beurre demi-sel + autres
```

```
UI: Sur $PREVIEW_URL/plats/nouveau (ou fiche technique)
1. Taper "beurre" dans la recherche ingrédient
2. Vérifier: suggestions apparaissent en < 200ms
3. Taper "escalope" → ≥ 2 résultats
```

### Step 7: Test Crons Phase 6

```bash
# Cron onboarding-notifications
curl -H "Authorization: Bearer $CRON_SECRET" "$PREVIEW_URL/api/cron/onboarding-notifications"
# Attendu: {"notified":N}

# Vérifier vercel.json contient les 3 crons
cat vercel.json
# rappelconso 21h + temperature-reminders 7h+17h + onboarding 10h
```

### Step 8: TypeCheck + Build

```bash
npm run typecheck && npm run build && npm run lint
npm run test:unit -- ingredients-catalog push-notifications
```

### Step 9: Screenshots comme evidence

Capturer:
- Onboarding étape 1 (type établissement)
- Dashboard post-onboarding avec OnboardingProgress
- IOSInstallPrompt sur iPhone (ou Playwright webkit)
- Catalogue ingrédients dans formulaire (recherche "beurre")
- Rapport Lighthouse PWA score

## Acceptance Criteria

- [ ] Onboarding J1 complet en < 2 minutes (mesuré Playwright)
- [ ] Redirect dashboard après onboarding (non bloquant)
- [ ] Lighthouse PWA score ≥ 90
- [ ] Meta tags iOS présents (`apple-mobile-web-app-capable`)
- [ ] Catalogue: ≥ 500 ingrédients en BDD
- [ ] Recherche ingrédient < 200ms dans l'UI
- [ ] Push subscription stockée en BDD après permission accordée
- [ ] Crons onboarding J2/J3 → 200
- [ ] `npm run build` → 0 erreur

## Testing Protocol

### Playwright complet
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pwa.spec.ts --project="iPhone 14 Safari"
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/onboarding-complete.spec.ts --project="iPhone 14 Safari"
```

### Vitest
```bash
npm run test:unit -- ingredients-catalog push-notifications
```

### Lighthouse
```bash
npx lighthouse "$PREVIEW_URL/dashboard" --only-categories=pwa
```

## Git

- Merger `phase-6/finitions` vers `develop` après régression réussie
- Tag: `phase-6-complete`
- Commit message: `Task 6.R: Phase 6 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 6 entière comme ✅ COMPLETE dans PROGRESS.md.
