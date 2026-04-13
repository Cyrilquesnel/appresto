# Task 2.R: Régression Phase 2 — OPÉRER

## Objective
Validation complète du flux photo → fiche technique → coût de revient sur environnement Vercel preview déployé.

## Context
Validation de toute la Phase 2 (OPÉRER). Si ce flux ne fonctionne pas de bout en bout, les phases suivantes (ACHETER, PILOTER) n'ont pas de base solide.

## Dependencies
- Toutes les tâches Phase 2 complètes (2.1, 2.2, 2.3, 2.4, 2.5)

## Blocked By
- Tasks 2.1 → 2.5 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
# Merger phase-2/operer vers develop
git checkout develop
git merge phase-2/operer

# Vercel déploie automatiquement sur push develop
git push origin develop

# Ou déploiement manuel :
vercel deploy --yes
# Note: GEMINI_API_KEY et ANTHROPIC_API_KEY doivent être configurés dans Vercel
```

Configurer dans Vercel dashboard → Settings → Environment Variables (Preview) :
- `GEMINI_API_KEY` — clé Google AI Studio
- `ANTHROPIC_API_KEY` — clé Anthropic
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (si disponible)

### Step 2: Test flux photo complet (Playwright MCP)

Sur l'URL preview :

**2a. Upload photo et analyse Gemini**
```
1. Se connecter sur $PREVIEW_URL/login
2. Naviguer vers $PREVIEW_URL/plats/nouveau
3. Cliquer sur le composant DishCamera
4. Uploader tests/fixtures/dish-steak.jpg
5. Attendre < 5s → vérifier liste ingrédients apparaît
6. Vérifier: au moins 2 ingrédients détectés
```

**2b. Validation ingrédients**
```
1. Modifier le grammage du premier ingrédient (ex: 180 → 200)
2. Supprimer le deuxième ingrédient
3. Rechercher "beurre" → vérifier suggestions en < 500ms
4. Ajouter "beurre" depuis la recherche
5. Vérifier que les 3 actions sont bien reflétées dans l'UI
```

**2c. Création fiche technique**
```
1. Remplir le nom: "Steak frites test"
2. Prix de vente: "22"
3. Cliquer "Sauvegarder la fiche"
4. Vérifier redirect vers /plats/[id]
5. Vérifier: allergènes affichés correctement
6. Vérifier: cout_de_revient = null (pas encore de prix mercuriale)
```

### Step 3: Test enrichissement Claude

```bash
# Uploader une photo avec confiance faible (photo floue ou inhabituelle)
# Vérifier dans les logs Vercel que Claude a été appelé
# OU: tester directement l'API
curl -X POST "$PREVIEW_URL/api/analyze-dish" \
  -H "x-restaurant-id: YOUR_RESTAURANT_ID" \
  -F "image=@tests/fixtures/dish-steak.jpg"

# Vérifier dans la réponse: enrichissement_utilise: true/false
# Vérifier: allergenes présents dans les ingrédients
```

### Step 4: Test cascade prix → coûts

```bash
# 1. Dans Supabase dashboard → SQL Editor :
# Insérer un fournisseur et un prix pour un ingrédient du plat test

INSERT INTO fournisseurs (restaurant_id, nom) VALUES ('YOUR_RESTAURANT_ID', 'Test Fournisseur') RETURNING id;
-- Note le fournisseur_id

INSERT INTO mercuriale (restaurant_id, ingredient_id, fournisseur_id, prix, unite, est_actif)
VALUES ('YOUR_RESTAURANT_ID', 'INGREDIENT_ID', 'FOURNISSEUR_ID', 15.00, 'kg', true);

# 2. Attendre 5-10 secondes
# 3. Vérifier: plats.cout_de_revient mis à jour
SELECT id, nom, cout_de_revient FROM plats WHERE restaurant_id = 'YOUR_RESTAURANT_ID';

# 4. Vérifier: fiche_technique_versions a un nouveau snapshot
SELECT * FROM fiche_technique_versions WHERE plat_id = 'PLAT_ID' ORDER BY created_at DESC;
```

### Step 5: Test Playwright iPhone 14

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/ --project="iPhone 14 Safari" --grep "dish-photo"
```

Test manuel sur Safari iPhone (si Playwright webkit ne peut pas tester le `input[capture]`) :
- Vérifier que l'input photo est cliquable
- L'upload d'une photo depuis la galerie fonctionne

### Step 6: Vérification RLS Phase 2

```bash
# pgTAP: un restaurant ne peut pas lire les plats d'un autre
# Créer un second compte test sur $PREVIEW_URL/register
# Vérifier que /plats ne montre PAS les plats du premier compte
```

```sql
-- Dans Supabase: tenter de lire les plats d'un autre restaurant
SELECT * FROM plats WHERE restaurant_id = 'AUTRE_RESTAURANT_ID';
-- Résultat attendu: 0 résultats (RLS bloque silencieusement)
```

### Step 7: Vérification Upstash Rate Limit

```bash
# Vérifier dans Upstash dashboard:
# - Clé "dish_analysis:{restaurant_id}" présente
# - TTL d'environ 24h
# Ou: tester le rate limit (21 analyses → 429)
```

### Step 8: Screenshots comme evidence

Capturer:
- Page liste plats (avec le plat créé)
- Page fiche technique (avec ingrédients + allergènes)
- Dashboard Supabase montrant cout_de_revient mis à jour
- Logs Edge Function recalculate-costs

### Step 9: TypeCheck + Build final

```bash
npm run typecheck  # 0 erreur
npm run build      # build production sans erreur
npm run lint       # 0 erreur
npm run test:unit  # tous les tests passent
```

## Acceptance Criteria

- [ ] Upload photo steak → ingrédients retournés en < 5s
- [ ] Validation UI: supprimer/modifier/ajouter ingrédient fonctionne
- [ ] Création fiche technique → plat visible dans liste
- [ ] Allergènes calculés et affichés correctement
- [ ] UPDATE mercuriale → cout_de_revient mis à jour dans les 10s
- [ ] Nouveau snapshot fiche_technique_versions créé après recalcul
- [ ] RLS: restaurant B ne voit pas les plats du restaurant A
- [ ] Playwright iPhone 14: flux validé sur webkit
- [ ] `npm run build` + `typecheck` + `lint` → 0 erreur
- [ ] Logs Vercel: aucune erreur 500

## Testing Protocol

### Playwright
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/smoke.spec.ts tests/e2e/dish-photo-flow.spec.ts
```

### curl
```bash
curl -f "$PREVIEW_URL/api/health" | jq .
```

### Build
```bash
npm run build && npm run typecheck && npm run lint
```

## Git

- Merger `phase-2/operer` vers `develop` après régression réussie
- Tag: `phase-2-complete`
- Commit message: `Task 2.R: Phase 2 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 2 entière comme ✅ COMPLETE dans PROGRESS.md.
Indiquer l'URL Vercel preview utilisée pour les tests.
