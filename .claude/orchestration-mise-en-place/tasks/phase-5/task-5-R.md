# Task 5.R: Régression Phase 5 — PMS

## Objective
Validation complète du module PMS sur Vercel preview : températures, checklists, réceptions, HACCP, RappelConso, export DDPP, offline.

## Context
Le PMS est le module le plus critique légalement. Toute régression sur l'immuabilité ou le HACCP est bloquante.

## Dependencies
- Toutes les tâches Phase 5 complètes (5.1 → 5.7)

## Blocked By
- Tasks 5.1 → 5.7 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
git checkout develop
git merge phase-5/pms
git push origin develop
```

### Step 2: Test Températures

```
1. Sur $PREVIEW_URL/pms/temperatures
2. Créer un équipement "Frigo 1" (frigo, 0-4°C)
3. Saisir 3.5°C → vérifier: badge vert "Conforme"
4. Saisir 6°C → vérifier: alerte rouge immédiate + champ action corrective
5. Remplir action corrective → valider
6. Vérifier: relevé enregistré avec action_corrective en BDD
7. Vérifier: tentative UPDATE en SQL → ERREUR (RLS)
```

### Step 3: Test Checklists

```
1. Sur $PREVIEW_URL/pms/checklists
2. Valider la checklist "Contrôle avant service":
   - Cocher tous les items obligatoires
   - Cliquer "Valider"
3. Vérifier: checklist marquée "Complète" pour aujourd'hui
4. Recharger la page → toujours marquée complète
5. Vérifier en BDD: nettoyage_completions contient 1 ligne pour aujourd'hui
```

### Step 4: Test Réception Marchandises

```
1. Sur $PREVIEW_URL/pms/receptions
2. Créer une réception:
   - Fournisseur: Pomona Test
   - 3 produits avec DLC et numéros lot
   - 1 produit avec DLC d'hier → vérifier alerte rouge
   - 1 produit non-conforme → remplir description anomalie
3. Vérifier: réception créée avec statut "anomalie"
4. Vérifier: historique des réceptions visible
```

### Step 5: Test HACCP (avec 3+ plats actifs)

```
1. Vérifier que 3+ plats actifs existent (ou en créer depuis /plats)
2. Sur $PREVIEW_URL/pms/haccp
3. Cliquer "Générer mon plan HACCP"
4. Attendre < 30s → plan généré
5. Vérifier: au moins un CCP avec température critique pour la volaille (74°C)
6. Vérifier: points sauvegardés en BDD
```

```
Avec < 3 plats actifs:
- Bouton grisé
- Message "Créez au moins 3 plats actifs"
```

### Step 6: Test RappelConso

```bash
# Tester le cron sur $PREVIEW_URL
curl -H "Authorization: Bearer $CRON_SECRET" "$PREVIEW_URL/api/cron/rappelconso"
# Attendu: {"processed":N,"alerts":M}

# Vérifier: aucune erreur 500 dans Vercel logs
```

```
1. Sur $PREVIEW_URL/pms/rappels
2. Vérifier: page accessible (même sans alertes)
3. Si alerte créée: vérifier "Marquer comme traité" fonctionne
```

### Step 7: Test Export DDPP

```
1. Sur $PREVIEW_URL/pms/export
2. Vérifier: compteurs (relevés T°, checklists) correspondent aux données saisies
3. Cliquer "Mode Inspecteur"
4. Mesurer le temps: < 10s
5. Vérifier: PDF téléchargé contient:
   - En-tête restaurant
   - Relevés de température (y compris le 6°C non-conforme en rouge)
   - Plan HACCP avec CCP-1
```

### Step 8: Test Offline PWA

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pms-offline.spec.ts
```

Test manuel sur iPhone (si possible) :
```
1. Installer l'app PWA sur iPhone
2. Activer mode avion
3. Ouvrir /pms/temperatures
4. Vérifier badge "Mode hors-ligne"
5. Saisir une température (6°C)
6. Désactiver mode avion
7. Attendre 5-10s → vérifier relevé en BDD
```

### Step 9: pgTAP — immuabilité complète

```bash
supabase test db
```

Vérifications critiques :
```sql
-- temperature_logs immuable
UPDATE temperature_logs SET valeur = 99 WHERE id = (SELECT id FROM temperature_logs LIMIT 1);
-- ERREUR attendue: nouvelle politque RLS

-- nettoyage_completions immuable
UPDATE nettoyage_completions SET notes_generales = 'hack' WHERE id = ...;
-- ERREUR attendue
```

### Step 10: Screenshots comme evidence

Capturer:
- Page températures avec relevé conforme (vert) et non-conforme (rouge)
- Page checklists avec checklist complétée
- Plan HACCP généré
- Page export DDPP avec compteurs
- PDF DDPP téléchargé (vignette de la première page)

### Step 11: TypeCheck + Build

```bash
npm run typecheck && npm run build && npm run lint && npm run test:unit
```

## Acceptance Criteria

- [ ] Relevé T° en 2 taps — conforme ou non-conforme avec alerte
- [ ] T° hors plage → alerte immédiate rouge visible
- [ ] Offline → relevé → retour réseau → sync automatique (Playwright)
- [ ] "Mode Inspecteur" → PDF téléchargé en < 10s
- [ ] pgTAP: temperature_logs immuable (UPDATE/DELETE rejected)
- [ ] pgTAP: nettoyage_completions immuable
- [ ] Cron rappelconso → 200 + heartbeat BetterUptime
- [ ] HACCP: bouton grisé < 3 plats, fonctionnel ≥ 3 plats
- [ ] Export DDPP: contient températures + HACCP + en-tête restaurant
- [ ] iPhone 14 (Playwright webkit): saisie T° < 5s
- [ ] `npm run build` → 0 erreur

## Testing Protocol

### Playwright (tous les projets)
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pms-offline.spec.ts --project="iPhone 14 Safari"
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/pms-offline.spec.ts --project="Desktop Chrome"
```

### pgTAP
```bash
supabase test db
```

### curl cron
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "$PREVIEW_URL/api/cron/rappelconso"
```

## Git

- Merger `phase-5/pms` vers `develop` après régression réussie
- Tag: `phase-5-complete`
- Commit message: `Task 5.R: Phase 5 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 5 entière comme ✅ COMPLETE dans PROGRESS.md.
