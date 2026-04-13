# Task 3.R: Régression Phase 3 — ACHETER

## Objective
Validation complète du flux achat : fournisseur → mercuriale → OCR facture → bon de commande → envoi WhatsApp/email/PDF.

## Context
Validation de toute la Phase 3 (ACHETER). Le flux doit fonctionner de bout en bout sur Vercel preview. La cascade prix → coûts doit aussi être vérifiée.

## Dependencies
- Toutes les tâches Phase 3 complètes (3.1, 3.2, 3.3, 3.4)

## Blocked By
- Tasks 3.1 → 3.4 toutes complètes

## Implementation Plan

### Step 1: Déploiement Vercel Preview

```bash
git checkout develop
git merge phase-3/acheter
git push origin develop
# Vercel déploie automatiquement
```

Variables d'environnement Vercel à vérifier :
- `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
- `RESEND_API_KEY`

### Step 2: Test Fournisseur + Mercuriale

**Sur $PREVIEW_URL :**

```
1. Naviguer vers $PREVIEW_URL/mercuriale/fournisseurs
2. Créer un fournisseur:
   - Nom: "Pomona Test"
   - WhatsApp: +33600000000
   - Email: test@test.fr
   - Délai: 2j
3. Vérifier: fournisseur apparaît dans la liste

4. Naviguer vers $PREVIEW_URL/mercuriale
5. Ajouter un prix pour "beurre":
   - Fournisseur: Pomona Test
   - Prix: 8.50 €/kg
6. Vérifier: prix affiché dans la mercuriale table
7. Attendre 10s → vérifier cout_de_revient mis à jour dans /plats
```

### Step 3: Test OCR Facture (Playwright)

```bash
# Upload la fixture facture
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/ --grep "invoice"
```

Test manuel :
```
1. Naviguer vers $PREVIEW_URL/mercuriale
2. Cliquer "Scanner une facture"
3. Uploader tests/fixtures/invoice-sample.jpg
4. Vérifier: données extraites affichées (désignations, prix)
5. Vérifier: ligne matchée → mercuriale mise à jour automatiquement
6. Vérifier: ligne non matchée → flag "association manuelle requise"
```

### Step 4: Test Bon de Commande complet

```
1. Naviguer vers $PREVIEW_URL/commandes/nouveau
2. Sélectionner "Pomona Test" comme fournisseur
3. Date de livraison: demain
4. Ajouter 3 lignes de produits avec quantités
5. Vérifier total HT calculé correctement
6. Cliquer "Créer le bon de commande"
7. Vérifier redirect vers /commandes/[id]

8. Tester envoi WhatsApp:
   - Cliquer "Envoyer via WhatsApp"
   - Vérifier: statut passe à "envoye"
   - Vérifier dans Meta sandbox: message reçu

9. Tester téléchargement PDF:
   - Cliquer "Télécharger PDF"
   - Vérifier: download démarre en < 3s
   - Vérifier: PDF contient nom fournisseur + lignes + total
```

### Step 5: Test cascade prix → coûts Phase 3

```bash
# Modifier un prix dans la mercuriale
# Vérifier que les plats contenant cet ingrédient sont mis à jour
curl -X POST "$PREVIEW_URL/api/trpc/commandes.setMercurialePrice" \
  -H "Content-Type: application/json" \
  -d '{"json":{"ingredient_id":"...","fournisseur_id":"...","prix":10.00,"unite":"kg"}}'

sleep 10

# Vérifier cout_de_revient dans /plats
```

### Step 6: Test Playwright iPhone 14

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/ --project="iPhone 14 Safari" --grep "commandes"
```

Test visuel :
```
- Vérifier que la liste des bons est lisible sur mobile
- Vérifier que SendBonOptions est utilisable sur mobile (boutons assez grands)
- Vérifier que le scanner facture fonctionne (input capture visible)
```

### Step 7: Vérification RLS

```sql
-- Dans Supabase dashboard → SQL Editor
-- Connecté comme user d'un restaurant différent
SELECT * FROM bons_de_commande WHERE restaurant_id = 'AUTRE_RESTAURANT_ID';
-- Résultat attendu: 0 lignes

SELECT * FROM fournisseurs WHERE restaurant_id = 'AUTRE_RESTAURANT_ID';
-- Résultat attendu: 0 lignes

SELECT * FROM mercuriale WHERE restaurant_id = 'AUTRE_RESTAURANT_ID';
-- Résultat attendu: 0 lignes
```

### Step 8: Vérifier Resend Dashboard

```
1. Aller sur resend.com → dashboard
2. Vérifier qu'un email a été reçu pour le test d'envoi
3. Vérifier: sujet contient le nom du restaurant
4. Vérifier: PDF joint si envoyé avec PDF
```

### Step 9: Screenshots comme evidence

Capturer:
- Page mercuriale avec prix
- Page fournisseurs
- Bon de commande créé (détail)
- PDF téléchargé (vignette)
- Conversation WhatsApp avec message reçu
- Inbox Resend avec email

### Step 10: TypeCheck + Build

```bash
npm run typecheck  # 0 erreur
npm run build      # build production sans erreur
npm run lint       # 0 erreur
npm run test:unit  # tous passent (mercuriale + invoice + pdf)
```

## Acceptance Criteria

- [ ] Ajouter fournisseur avec WhatsApp → apparaît dans liste
- [ ] Définir prix mercuriale → cascade → cout_de_revient plats mis à jour (< 10s)
- [ ] OCR facture → prix extrait pour ingrédient connu → mercuriale mise à jour
- [ ] Générer bon de commande 5 lignes → total HT correct
- [ ] Envoi WhatsApp → message reçu dans Meta sandbox
- [ ] Téléchargement PDF → < 3s
- [ ] Email Resend → reçu (dashboard Resend)
- [ ] RLS: isolation complète fournisseurs/mercuriale/bons entre restaurants
- [ ] iPhone 14 (Playwright webkit): flux validé
- [ ] `npm run build` → 0 erreur

## Testing Protocol

### Playwright
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npx playwright test tests/e2e/commandes-flow.spec.ts
```

### pgTAP
```bash
supabase test db
```

### Build
```bash
npm run build && npm run typecheck && npm run lint && npm run test:unit
```

## Git

- Merger `phase-3/acheter` vers `develop` après régression réussie
- Tag: `phase-3-complete`
- Commit message: `Task 3.R: Phase 3 regression — all checks green`

## PROGRESS.md Update

Marquer Phase 3 entière comme ✅ COMPLETE dans PROGRESS.md.
