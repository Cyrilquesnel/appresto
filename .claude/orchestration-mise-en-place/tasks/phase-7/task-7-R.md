# Task 7.R: Régression Phase 7 — CI/CD & Monitoring

## Objective
Validation complète CI/CD, monitoring, et déploiement production. Pipeline GitHub Actions vert, BetterUptime actif, Sentry propre.

## Context
Phase 7 = infrastructure DevOps. La régression valide que le pipeline CI est entièrement vert, que le monitoring fonctionne, et que la production est stable.

## Dependencies
- Toutes les tâches Phase 7 complètes (7.1 → 7.5)

## Blocked By
- Tasks 7.1 → 7.5 toutes complètes

## Implementation Plan

### Step 1: Test PR complète GitHub Actions

```bash
# Créer une PR test depuis une branch feature
git checkout -b test/phase-7-regression
echo "# Test PR" >> docs/test-pr.md
git add docs/test-pr.md
git commit -m "test: PR validation phase 7"
git push origin test/phase-7-regression
# Ouvrir une PR sur GitHub → vérifier que TOUS les jobs passent:
# - quality: typecheck + lint + prettier ✅
# - unit-tests: coverage ≥ 80% ✅
# - integration-tests: pgTAP ✅
# - deploy-preview: URL Vercel générée ✅
# - e2e-tests: Playwright verts ✅
```

### Step 2: Tests pgTAP — 100% verts

```bash
supabase start
supabase db reset
supabase test db

# Attendu output:
# ok 1 - INSERT temperature_log autorisé
# ok 2 - UPDATE sur temperature_logs rejeté par RLS
# ok 3 - DELETE sur temperature_logs rejeté par RLS
# ok 4 - INSERT nettoyage_completion autorisé
# ok 5 - UPDATE sur nettoyage_completions rejeté par RLS
# ok 6 - DELETE sur nettoyage_completions rejeté par RLS
# ok 7 - User A voit ses plats
# ok 8 - User A ne voit pas les plats de restaurant B
# ...
# # Passed: N
# # Failed: 0
```

### Step 3: Vérification BetterUptime

```
1. Dashboard BetterUptime:
   - Monitor "Mise en Place — Uptime": vert (temps de réponse affiché)
   - Heartbeat "Cron RappelConso (21h)": vert (dernier ping < 24h)
   - Heartbeat "Cron Températures": vert

2. Tester l'alerte (optionnel — risque de spam email):
   - Simuler DOWN en stopant l'app localement (Vercel preview déjà up)
   - Attendre 3-4 min → alerte email reçue
```

### Step 4: Sentry — Dashboard propre

```bash
# Vérifier dashboard Sentry:
# - 0 issues non résolues en production
# - Performance: latence P50 < 500ms, P95 < 2s
# - Source maps: stack traces lisibles (pas [native code])

# Déclencher une erreur test (puis la résoudre dans Sentry):
curl "$PREVIEW_URL/api/test-sentry-error"
# Vérifier apparition dans Sentry < 30s
```

### Step 5: Vérification production complète

```bash
# Flux complet en production
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" npx playwright test \
  tests/e2e/auth.spec.ts \
  --project="Desktop Chrome"

# Health check
curl https://app.miseenplace.fr/api/health
# Attendu: {"status":"ok","version":"abc1234","region":"fra1"}

# Vérifier crons Vercel
vercel crons ls
# Attendu: 3 crons listés
```

### Step 6: Screenshots comme evidence

Capturer:
- GitHub Actions: tous les jobs verts (screenshot de la PR)
- BetterUptime dashboard: tous monitors verts
- Sentry dashboard: 0 issues non résolues
- Vercel dashboard: crons actifs + déploiement production
- `supabase test db` output: tous les pgTAP verts

### Step 7: TypeCheck + Build final

```bash
npm run typecheck
npm run build
npm run lint
npm run test:unit

# Attendu: 0 erreur, build réussi, tous tests verts
```

## Acceptance Criteria

- [ ] PR → pipeline CI complet vert (quality + unit + integration + e2e + deploy preview)
- [ ] `supabase test db` → 100% pgTAP verts (isolation + immuabilité)
- [ ] BetterUptime: tous monitors verts
- [ ] Sentry dashboard propre (0 issues non résolues)
- [ ] Production: flux complet photo → fiche → commande → PMS
- [ ] `/api/health` → 200 en production
- [ ] Crons Vercel listés et actifs
- [ ] `npm run build` → 0 erreur

## Testing Protocol

### GitHub Actions
```bash
# Ouvrir une PR test → vérifier tous les jobs verts
# Merger vers main → vérifier deploy-prod.yml vert
```

### pgTAP
```bash
supabase test db
```

### Playwright production
```bash
PLAYWRIGHT_BASE_URL="https://app.miseenplace.fr" npx playwright test tests/e2e/auth.spec.ts
```

### Curl crons production
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://app.miseenplace.fr/api/cron/rappelconso
curl -H "Authorization: Bearer $CRON_SECRET" https://app.miseenplace.fr/api/cron/temperature-reminders
```

## Git

- Merger `phase-7/cicd` vers `develop` puis `main` après régression réussie
- Tag: `phase-7-complete`
- Commit message: `Task 7.R: Phase 7 regression — CI/CD all green`

## PROGRESS.md Update

Marquer Phase 7 entière comme ✅ COMPLETE dans PROGRESS.md.
