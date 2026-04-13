# Task 8.4: Préparation Beta + Onboarding Testeurs

## Objective
Guide d'onboarding beta testeurs, comptes créés, données de démonstration réalistes, procédure de feedback claire.

## Context
Critère de succès beta: 7/10 testeurs actifs semaine 2, NPS > 30. Les 3-4 premiers testeurs sont des restaurateurs de confiance. Chaque testeur a un compte pré-créé avec 5 plats, 3 fournisseurs, 7j de relevés de température déjà saisis — pour qu'ils voient immédiatement la valeur.

## Dependencies
- Task 8.1 — tous les flux testés et stables
- Task 8.2 — performance validée
- Task 8.3 — sécurité validée

## Blocked By
- Tasks 8.1 + 8.2 + 8.3

## Implementation Plan

### Step 1: supabase/seed-demo.sql

```sql
-- supabase/seed-demo.sql
-- Données de démonstration pour les comptes beta
-- À exécuter APRÈS avoir créé les comptes via scripts/create-beta-accounts.ts

DO $$
DECLARE
  beta_restaurant_id UUID;
BEGIN
  -- Récupérer l'ID du restaurant beta (créé par create-beta-accounts.ts)
  SELECT id INTO beta_restaurant_id
  FROM restaurants
  WHERE nom ILIKE '%Demo%'
  LIMIT 1;

  IF beta_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant demo non trouvé. Lancer create-beta-accounts.ts d''abord.';
  END IF;

  -- 3 fournisseurs
  INSERT INTO fournisseurs(id, restaurant_id, nom, telephone, whatsapp, email)
  VALUES
    (gen_random_uuid(), beta_restaurant_id, 'Pomona', '01 23 45 67 89', '+33123456789', 'commandes@pomona.fr'),
    (gen_random_uuid(), beta_restaurant_id, 'Metro Cash & Carry', '01 98 76 54 32', '+33198765432', 'pro@metro.fr'),
    (gen_random_uuid(), beta_restaurant_id, 'Transgourmet', '01 11 22 33 44', '+33111223344', NULL);

  -- 5 plats avec fiches techniques
  INSERT INTO plats(id, restaurant_id, nom, actif, prix_vente_ht)
  VALUES
    (gen_random_uuid(), beta_restaurant_id, 'Entrecôte grillée', true, 28.00),
    (gen_random_uuid(), beta_restaurant_id, 'Risotto aux champignons', true, 18.00),
    (gen_random_uuid(), beta_restaurant_id, 'Pavé de saumon', true, 22.00),
    (gen_random_uuid(), beta_restaurant_id, 'Tarte Tatin', true, 9.00),
    (gen_random_uuid(), beta_restaurant_id, 'Salade César', true, 14.00);

  -- 7 jours de relevés de température (équipement frigo)
  INSERT INTO equipements_pms(id, restaurant_id, nom, type, temp_min, temp_max, frequence_releve)
  VALUES
    (gen_random_uuid(), beta_restaurant_id, 'Chambre froide positive', 'frigo', 0, 4, 'quotidien'),
    (gen_random_uuid(), beta_restaurant_id, 'Congélateur', 'congelateur', -25, -18, 'quotidien');

  -- Relevés T° 7 derniers jours (conforme sauf J-3 = 5.2°C)
  FOR i IN 0..6 LOOP
    INSERT INTO temperature_logs(restaurant_id, equipement_id, valeur, conforme, created_at)
    SELECT
      beta_restaurant_id,
      ep.id,
      CASE
        WHEN ep.type = 'frigo' THEN
          CASE WHEN i = 3 THEN 5.2 ELSE (2.1 + random())::numeric(3,1) END
        ELSE
          (-22.0 - random())::numeric(4,1)
      END,
      CASE
        WHEN ep.type = 'frigo' AND i = 3 THEN false
        ELSE true
      END,
      NOW() - (i || ' days')::interval
    FROM equipements_pms ep
    WHERE ep.restaurant_id = beta_restaurant_id;
  END LOOP;

  -- Checklists pré-service (5 derniers jours complétées)
  INSERT INTO checklists_nettoyage(id, restaurant_id, nom, type, items)
  VALUES (
    gen_random_uuid(),
    beta_restaurant_id,
    'Contrôle avant service',
    'pre_service',
    '[
      {"id": "1", "label": "Températures relevées", "obligatoire": true},
      {"id": "2", "label": "Plans de travail désinfectés", "obligatoire": true},
      {"id": "3", "label": "Mains lavées", "obligatoire": true},
      {"id": "4", "label": "Matériel propre vérifié", "obligatoire": false},
      {"id": "5", "label": "Dates DLC vérifiées", "obligatoire": true}
    ]'::jsonb
  );

  -- 5 jours de completions
  FOR i IN 1..5 LOOP
    INSERT INTO nettoyage_completions(restaurant_id, checklist_id, date_completion, auteur_id, items_valides, duree_minutes)
    SELECT
      beta_restaurant_id,
      cl.id,
      CURRENT_DATE - i,
      (SELECT user_id FROM restaurants WHERE id = beta_restaurant_id),
      '[{"id":"1","valide":true},{"id":"2","valide":true},{"id":"3","valide":true},{"id":"4","valide":true},{"id":"5","valide":true}]'::jsonb,
      8
    FROM checklists_nettoyage cl
    WHERE cl.restaurant_id = beta_restaurant_id;
  END LOOP;

  RAISE NOTICE 'Données demo insérées pour restaurant %', beta_restaurant_id;
END;
$$;
```

### Step 2: scripts/create-beta-accounts.ts

```typescript
// scripts/create-beta-accounts.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role pour créer des users
)

const BETA_ACCOUNTS = [
  {
    email: 'beta1@miseenplace.fr',
    password: 'BetaTest2026!',
    restaurantNom: 'Restaurant Demo — Beta 1',
  },
  {
    email: 'beta2@miseenplace.fr',
    password: 'BetaTest2026!',
    restaurantNom: 'Restaurant Demo — Beta 2',
  },
  {
    email: 'beta3@miseenplace.fr',
    password: 'BetaTest2026!',
    restaurantNom: 'Restaurant Demo — Beta 3',
  },
]

async function createBetaAccounts() {
  for (const account of BETA_ACCOUNTS) {
    // Créer user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // Confirmer automatiquement
    })

    if (userError) {
      console.error(`Erreur création user ${account.email}:`, userError)
      continue
    }

    console.log(`✅ User créé: ${account.email}`)

    // Créer restaurant
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .insert({
        user_id: user.user.id,
        nom: account.restaurantNom,
        type_etablissement: 'restaurant',
        parametres: {
          type_etablissement: 'restaurant',
          onboarding_completed_at: new Date().toISOString(),
          is_beta: true,
        },
      })
      .select('id')
      .single()

    if (restError) {
      console.error(`Erreur création restaurant:`, restError)
      continue
    }

    console.log(`✅ Restaurant créé: ${restaurant.id}`)
  }

  console.log('\n🎉 Comptes beta créés. Lancer seed-demo.sql pour les données demo.')
}

createBetaAccounts().catch(console.error)
```

### Step 3: docs/beta-onboarding.md

```markdown
# Guide Beta — Mise en Place

Bienvenue dans la beta ! Voici comment tester les 3 fonctionnalités principales.

## Connexion

- URL: https://app.miseenplace.fr
- Email: [fourni séparément]
- Mot de passe: [fourni séparément]

## Ce que vous pouvez tester

### 1. Analyser un plat avec l'IA (2 min)
1. Allez dans **OPÉRER → Mes plats**
2. Appuyez sur **Nouveau plat**
3. Photographiez un plat de votre carte avec votre téléphone
4. Observez l'IA détecter automatiquement les ingrédients
5. Corrigez si besoin, validez

### 2. Gérer vos commandes fournisseurs (5 min)
1. Allez dans **ACHETER → Mercuriale**
2. Ajoutez les prix de vos ingrédients
3. Allez dans **ACHETER → Commandes**
4. Créez un bon de commande pour un fournisseur
5. Envoyez-le par WhatsApp ou email

### 3. PMS — Relevé de température (1 min)
1. Allez dans **PMS → Températures**
2. Saisissez la température de votre frigo
3. Si hors plage → l'alerte s'affiche automatiquement
4. En **PMS → Export** : générez votre rapport DDPP en 1 clic

## Comment nous donner votre avis

- **Email**: feedback@miseenplace.fr
- **WhatsApp**: +33 6 XX XX XX XX
- **In-app**: bouton "Feedback" en bas de chaque page (bientôt)

Merci pour votre aide ! 🙏
```

### Step 4: Commandes d'exécution

```bash
# 1. Créer les comptes beta
NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
  npx ts-node scripts/create-beta-accounts.ts

# 2. Injecter les données demo
psql $PROD_DB_URL -f supabase/seed-demo.sql

# 3. Vérifier
psql $PROD_DB_URL -c "SELECT count(*) FROM plats WHERE restaurant_id IN (SELECT id FROM restaurants WHERE nom ILIKE '%Demo%');"
# Attendu: 15 (5 plats × 3 restaurants)
```

## Files to Create

- `supabase/seed-demo.sql`
- `scripts/create-beta-accounts.ts`
- `docs/beta-onboarding.md`

## Files to Modify

- Aucun code source de l'app

## Acceptance Criteria

- [ ] 3 comptes beta créés et confirmés en production
- [ ] Chaque testeur peut se connecter et voir un restaurant pré-configuré avec données demo
- [ ] 5 plats, 3 fournisseurs, 7j de températures visibles dès la connexion
- [ ] Guide beta clair (1 page) couvrant les 3 flux principaux
- [ ] App stable sur iPhone de chaque testeur
- [ ] Procédure de feedback définie (email + WhatsApp)

## Testing Protocol

### Validation comptes beta
```bash
# Se connecter avec chaque compte beta sur app.miseenplace.fr
# Vérifier: dashboard visible avec données demo
# Vérifier: flux onboarding J1 complet en < 2 min (compte "vierge" pour test)
```

### Validation données demo
```bash
psql $PROD_DB_URL -c "
SELECT r.nom, 
  (SELECT count(*) FROM plats WHERE restaurant_id = r.id) as nb_plats,
  (SELECT count(*) FROM temperature_logs WHERE restaurant_id = r.id) as nb_releves
FROM restaurants r
WHERE r.parametres->>'is_beta' = 'true';
"
```

### Test iPhone physique
```
1. Envoyer le guide beta à chaque testeur
2. Vérifier que l'app s'installe (iOS: Share → Sur l'écran d'accueil)
3. Tester le flux photo sur le téléphone du testeur
4. Vérifier réception d'une notification push (si permission accordée)
```

## Git

- Branch: `phase-8/beta`
- Commit message prefix: `Task 8.4:`

## PROGRESS.md Update

Marquer Task 8.4 ✅ dans PROGRESS.md.
Marquer Phase 8 entière comme ✅ COMPLETE dans PROGRESS.md.
Marquer le projet comme PRÊT POUR BETA.
