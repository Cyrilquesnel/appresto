# Task 4.R: Régression Phase 4 — PILOTER

## Objective
Validation complète du dashboard et du flux de pilotage — ventes, food cost, charges, seuil de rentabilité, realtime.

## Context
Validation de toute la Phase 4 (PILOTER). Le dashboard doit charger en < 1s et se mettre à jour en temps réel.

## Dependencies
- Toutes les tâches Phase 4 complètes (4.1, 4.2, 4.3)

## Blocked By
- Tasks 4.1 → 4.3 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
git checkout develop
git merge phase-4/piloter
git push origin develop
```

### Step 2: Test saisie ventes + dashboard

```
1. Se connecter sur $PREVIEW_URL
2. Naviguer vers /dashboard/saisie-ventes
3. Saisir ventes midi:
   - Date: aujourd'hui
   - Service: Midi
   - Couverts: 25
   - Panier moyen: 30
4. Valider → écran succès (980,00 €)

5. Saisir ventes soir:
   - Couverts: 40
   - Panier moyen: 35
6. Valider → écran succès

7. Naviguer vers /dashboard
8. Vérifier: CA = 2180 €
9. Vérifier: nb_couverts = 65
10. Vérifier: panier_moyen ≈ 33.54 €
```

### Step 3: Test charges + seuil de rentabilité

```
1. Naviguer vers /settings ou /dashboard
2. Saisir les charges du mois:
   - Loyer: 3000 €
   - Énergie: 400 €
   - Assurances: 200 €
3. Saisir masse salariale: 8000 €
4. Naviguer vers /dashboard
5. Vérifier: seuil de rentabilité affiché
6. Vérifier: calcul correct (charges_fixes / (1 - food_cost_pct/100))
```

### Step 4: Test realtime (2 onglets)

```
1. Ouvrir /dashboard dans l'onglet 1
2. Dans l'onglet 2: saisir ventes supplémentaires
3. Vérifier: onglet 1 mise à jour en < 3s sans rechargement
4. Chronométrer: < 3s (utiliser la clock du navigateur)
```

### Step 5: Test performance

```bash
# Mesurer temps de chargement du dashboard
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/dashboard-realtime.spec.ts
```

Mesurer manuellement :
```javascript
// Dans la console du navigateur sur $PREVIEW_URL/dashboard
const timing = performance.timing
const loadTime = timing.loadEventEnd - timing.navigationStart
console.log(`Dashboard load time: ${loadTime}ms`)
// Attendu: < 1000ms
```

### Step 6: Test Playwright iPhone 14

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/ --project="iPhone 14 Safari" --grep "dashboard"
```

Vérifications manuelles iPhone :
- Dashboard lisible sur mobile (cards bien dimensionnées)
- Bouton "Saisir ventes" accessible
- Food cost card visible sans scroll

### Step 7: Vérification RLS

```sql
-- Ventes d'un restaurant non visibles par un autre
SELECT * FROM ventes WHERE restaurant_id = 'AUTRE_RESTAURANT';
-- Résultat: 0 lignes
```

### Step 8: Screenshots comme evidence

Capturer:
- Dashboard complet avec données (food cost vert + seuil rentabilité)
- Écran saisie ventes
- Dashboard iPhone 14 (screenshot Playwright)

### Step 9: TypeCheck + Build

```bash
npm run typecheck && npm run build && npm run lint && npm run test:unit
```

## Acceptance Criteria

- [ ] Dashboard chargement < 1s mesuré
- [ ] Saisie ventes (2 services) → CA correct affiché dans dashboard
- [ ] Food cost % calculé correctement (si prix mercuriale disponibles)
- [ ] Seuil de rentabilité affiché après saisie des charges
- [ ] Realtime: onglet 2 saisit → onglet 1 se met à jour en < 3s
- [ ] Charges saisies → charges_fixes + seuil recalculés
- [ ] RLS: ventes d'un restaurant non visibles par un autre
- [ ] iPhone 14 (Playwright webkit): dashboard complet lisible
- [ ] `npm run build` → 0 erreur

## Testing Protocol

### Playwright
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/dashboard-realtime.spec.ts
```

### Performance
- Navigation Timing API dans la console navigateur
- Objectif: < 1000ms

### pgTAP
```bash
supabase test db
```

## Git

- Merger `phase-4/piloter` vers `develop` après régression réussie
- Tag: `phase-4-complete`
- Commit message: `Task 4.R: Phase 4 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 4 entière comme ✅ COMPLETE dans PROGRESS.md.
