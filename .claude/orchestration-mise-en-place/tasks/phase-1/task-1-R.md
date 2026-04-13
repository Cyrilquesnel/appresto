# Task 1.R: Régression Phase 1

## Objective
Valider l'intégralité de la Phase 1 sur un environnement Vercel preview déployé. Tous les flux auth doivent fonctionner, le health check doit répondre, la CI doit être verte.

## Context
C'est la validation complète de la fondation. Si quelque chose échoue ici, les phases suivantes ne peuvent pas commencer. Tester sur l'URL Vercel preview (pas localhost).

## Dependencies
- Toutes les tâches Phase 1 complètes (1.1, 1.2, 1.3, 1.4, 1.5, 1.6)

## Blocked By
- Tasks 1.1 → 1.6 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
# Installer Vercel CLI si pas déjà fait
npm install -g vercel

# Login Vercel
vercel login

# Déployer preview depuis la branch develop
git push origin develop
# Vercel déploie automatiquement sur push (si connecté au repo GitHub)
# OU déploiement manuel :
vercel deploy --yes
```

Récupérer l'URL preview (ex: `https://mise-en-place-abc123.vercel.app`).

Configurer les variables d'environnement dans Vercel dashboard (pour le preview) :
- `NEXT_PUBLIC_SUPABASE_URL` : URL du projet Supabase de staging/test
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` : URL Vercel preview

**Note** : Pour cette régression, utiliser le Supabase local via tunnel ou créer un projet Supabase cloud gratuit pour les tests.

### Step 2: Smoke test health check

```bash
PREVIEW_URL="https://mise-en-place-abc123.vercel.app"

curl -f "$PREVIEW_URL/api/health"
# Attendu : {"status":"ok","checks":{"supabase":true},...}
```

Si status "degraded" → vérifier les variables d'environnement Vercel (Supabase URL/keys).

### Step 3: Tests Playwright sur URL preview

```bash
PLAYWRIGHT_BASE_URL="https://mise-en-place-abc123.vercel.app" npx playwright test tests/e2e/smoke.spec.ts --project="Desktop Chrome"
PLAYWRIGHT_BASE_URL="https://mise-en-place-abc123.vercel.app" npx playwright test tests/e2e/smoke.spec.ts --project="iPhone 14 Safari"
```

### Step 4: Test flux auth complet (Playwright MCP)

Utiliser Playwright MCP pour tester manuellement sur l'URL preview :

1. **Register** :
   - Naviguer vers `$PREVIEW_URL/register`
   - Remplir : nom restaurant "Test Bistrot", email "test@beta.fr", password "testpass123"
   - Submit → vérifier redirect vers `/onboarding`
   - Vérifier dans Supabase : `restaurants` et `restaurant_users` créés

2. **Login** :
   - Naviguer vers `$PREVIEW_URL/login`
   - Remplir email + password
   - Submit → vérifier redirect vers `/dashboard`
   - Vérifier navigation mobile visible en bas

3. **Protection des routes** :
   - Ouvrir un onglet privé (pas de session)
   - Naviguer vers `$PREVIEW_URL/dashboard`
   - Vérifier redirect automatique vers `/login`

4. **Logout** :
   - Naviguer vers `$PREVIEW_URL/settings`
   - Cliquer "Se déconnecter"
   - Vérifier redirect vers `/login`
   - Vérifier que `/dashboard` redirige bien vers `/login` (session détruite)

### Step 5: Vérification CI GitHub Actions

```bash
git log --oneline -5  # Vérifier les derniers commits
```

Aller sur GitHub → Actions → vérifier que le dernier workflow CI est ✅ vert (quality + unit-tests).

### Step 6: Vérification RLS basique

Dans Supabase dashboard (local ou cloud) → SQL Editor :

```sql
-- Créer 2 utilisateurs de test manuellement si nécessaire
-- Puis vérifier isolation

-- Connecté comme user A (restaurant A)
SELECT * FROM plats WHERE restaurant_id = 'restaurant-b-id';
-- Attendu : 0 résultats (RLS bloque)
```

### Step 7: Screenshots comme evidence

Capturer screenshots de :
- Page login (desktop + iPhone 14)
- Page register
- Dashboard après login (navigation visible)
- Health check JSON dans le navigateur

### Step 8: TypeCheck + Build final

```bash
npm run typecheck  # 0 erreur
npm run build      # build production sans erreur
npm run lint       # 0 erreur
```

## Acceptance Criteria

- [ ] `$PREVIEW_URL/api/health` → `{"status":"ok"}` (HTTP 200)
- [ ] Register → restaurant créé en BDD → redirect /onboarding
- [ ] Login → redirect /dashboard
- [ ] /dashboard sans session → redirect /login
- [ ] Logout → session détruite → /dashboard redirige /login
- [ ] Navigation mobile visible sur iPhone 14 (Playwright webkit)
- [ ] GitHub Actions CI → tous les jobs verts
- [ ] `npm run build` → 0 erreur
- [ ] `npm run typecheck` → 0 erreur TypeScript
- [ ] Aucun secret dans `NEXT_PUBLIC_*` variables

## Testing Protocol

### Playwright Tests
```bash
# Sur URL preview
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/smoke.spec.ts
```

### Curl Tests
```bash
curl -f "$PREVIEW_URL/api/health" | jq .
```

### Build Check
```bash
npm run build && npm run typecheck && npm run lint
```

## Git

- Merger `phase-1/foundation` vers `develop` après régression réussie
- Tag: `phase-1-complete`
- Commit message: `Task 1.R: Phase 1 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 1 entière comme ✅ COMPLETE dans PROGRESS.md.
Indiquer l'URL Vercel preview utilisée pour les tests.
