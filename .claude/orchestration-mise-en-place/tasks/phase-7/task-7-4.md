# Task 7.4: pgTAP — Tests RLS Complets

## Objective
Suite de tests pgTAP vérifiant l'isolation RLS sur toutes les tables critiques et l'immuabilité de temperature_logs + nettoyage_completions.

## Context
pgTAP est un framework de tests pour PostgreSQL. Les tests vérifient: isolation inter-restaurant (0 fuite de données), immuabilité légale (UPDATE/DELETE rejected), isolation du stockage. Exécutés dans GitHub Actions via `supabase test db`.

## Dependencies
- Task 1.2 — tables BDD créées avec RLS

## Blocked By
- Task 1.2

## Implementation Plan

### Step 1: supabase/tests/rls_isolation.test.sql

```sql
-- supabase/tests/rls_isolation.test.sql
BEGIN;

SELECT plan(20);

-- Créer 2 restaurants + 2 users de test
DO $$
DECLARE
  user_a_id UUID := gen_random_uuid();
  user_b_id UUID := gen_random_uuid();
  restaurant_a_id UUID := gen_random_uuid();
  restaurant_b_id UUID := gen_random_uuid();
BEGIN
  -- Insérer via service role (bypass RLS)
  INSERT INTO auth.users(id, email) VALUES
    (user_a_id, 'test_a@miseenplace.fr'),
    (user_b_id, 'test_b@miseenplace.fr');

  INSERT INTO restaurants(id, user_id, nom) VALUES
    (restaurant_a_id, user_a_id, 'Restaurant A'),
    (restaurant_b_id, user_b_id, 'Restaurant B');

  -- Données pour restaurant A
  INSERT INTO plats(id, restaurant_id, nom, actif) VALUES
    (gen_random_uuid(), restaurant_a_id, 'Plat A', true);

  INSERT INTO mercuriale(id, restaurant_id, ingredient_id, prix, unite, est_actif) VALUES
    (gen_random_uuid(), restaurant_a_id, (SELECT id FROM ingredients_catalog LIMIT 1), 5.00, 'kg', true);

  INSERT INTO ventes(id, restaurant_id, date, ca_total) VALUES
    (gen_random_uuid(), restaurant_a_id, CURRENT_DATE, 1000);

  -- Simuler user A
  SET LOCAL request.jwt.claims TO json_build_object('sub', user_a_id::text, 'role', 'authenticated')::text;

  -- Test: User A voit ses plats
  SELECT results_eq(
    $$ SELECT count(*)::int FROM plats WHERE restaurant_id = $$ || quote_literal(restaurant_a_id),
    ARRAY[1],
    'User A voit 1 plat de restaurant A'
  );

  -- Test: User A ne voit pas les plats de restaurant B
  SELECT results_eq(
    $$ SELECT count(*)::int FROM plats WHERE restaurant_id = $$ || quote_literal(restaurant_b_id),
    ARRAY[0],
    'User A ne voit pas les plats de restaurant B'
  );

  -- Simuler user B
  SET LOCAL request.jwt.claims TO json_build_object('sub', user_b_id::text, 'role', 'authenticated')::text;

  -- Test: User B ne voit pas les ventes de restaurant A
  SELECT results_eq(
    $$ SELECT count(*)::int FROM ventes WHERE restaurant_id = $$ || quote_literal(restaurant_a_id),
    ARRAY[0],
    'User B ne voit pas les ventes de restaurant A'
  );

  -- Test: User B ne voit pas la mercuriale de A
  SELECT results_eq(
    $$ SELECT count(*)::int FROM mercuriale WHERE restaurant_id = $$ || quote_literal(restaurant_a_id),
    ARRAY[0],
    'User B ne voit pas la mercuriale de restaurant A'
  );
END;
$$;

SELECT finish();

ROLLBACK;
```

### Step 2: supabase/tests/rls_immutability.test.sql

```sql
-- supabase/tests/rls_immutability.test.sql
BEGIN;

SELECT plan(8);

-- Setup: insérer des données de test
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_restaurant_id UUID := gen_random_uuid();
  test_equipement_id UUID := gen_random_uuid();
  test_log_id UUID := gen_random_uuid();
  test_checklist_id UUID := gen_random_uuid();
  test_completion_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id, email) VALUES (test_user_id, 'immutability_test@test.fr');
  INSERT INTO restaurants(id, user_id, nom) VALUES (test_restaurant_id, test_user_id, 'Test Immutability');
  INSERT INTO equipements_pms(id, restaurant_id, nom, type, temp_min, temp_max)
    VALUES (test_equipement_id, test_restaurant_id, 'Frigo Test', 'frigo', 0, 4);
  INSERT INTO temperature_logs(id, restaurant_id, equipement_id, valeur, releve_par)
    VALUES (test_log_id, test_restaurant_id, test_equipement_id, 3.5, test_user_id);

  -- Checklists
  INSERT INTO checklists_nettoyage(id, restaurant_id, nom, type)
    VALUES (test_checklist_id, test_restaurant_id, 'Checklist Test', 'pre_service');
  INSERT INTO nettoyage_completions(id, restaurant_id, checklist_id, date_completion, auteur_id, items_valides)
    VALUES (test_completion_id, test_restaurant_id, test_checklist_id, CURRENT_DATE, test_user_id, '[]');

  -- Simuler user authentifié
  SET LOCAL request.jwt.claims TO json_build_object('sub', test_user_id::text, 'role', 'authenticated')::text;

  -- Test INSERT temperature_log OK
  SELECT lives_ok(
    $$ INSERT INTO temperature_logs(restaurant_id, equipement_id, valeur, releve_par)
       VALUES ($$ || quote_literal(test_restaurant_id) || $$, $$ || quote_literal(test_equipement_id) || $$, 2.0, $$ || quote_literal(test_user_id) || $$) $$,
    'INSERT temperature_log autorisé'
  );

  -- Test UPDATE temperature_log REJETÉ
  SELECT throws_ok(
    $$ UPDATE temperature_logs SET valeur = 99 WHERE id = $$ || quote_literal(test_log_id),
    'UPDATE sur temperature_logs rejeté par RLS'
  );

  -- Test DELETE temperature_log REJETÉ
  SELECT throws_ok(
    $$ DELETE FROM temperature_logs WHERE id = $$ || quote_literal(test_log_id),
    'DELETE sur temperature_logs rejeté par RLS'
  );

  -- Test INSERT nettoyage_completion OK
  SELECT lives_ok(
    $$ INSERT INTO nettoyage_completions(restaurant_id, checklist_id, date_completion, auteur_id, items_valides)
       VALUES ($$ || quote_literal(test_restaurant_id) || $$, $$ || quote_literal(test_checklist_id) || $$, CURRENT_DATE - 1, $$ || quote_literal(test_user_id) || $$, '[]') $$,
    'INSERT nettoyage_completion autorisé'
  );

  -- Test UPDATE nettoyage_completion REJETÉ
  SELECT throws_ok(
    $$ UPDATE nettoyage_completions SET notes_generales = 'hack' WHERE id = $$ || quote_literal(test_completion_id),
    'UPDATE sur nettoyage_completions rejeté par RLS'
  );

  -- Test DELETE nettoyage_completion REJETÉ
  SELECT throws_ok(
    $$ DELETE FROM nettoyage_completions WHERE id = $$ || quote_literal(test_completion_id),
    'DELETE sur nettoyage_completions rejeté par RLS'
  );
END;
$$;

-- Vérifier que les politiques RLS existent sur temperature_logs
SELECT has_function('search_ingredients', ARRAY['text', 'uuid', 'integer'], 'Fonction search_ingredients existe');

-- Vérifier RLS activé sur temperature_logs
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'temperature_logs'),
  'RLS activé sur temperature_logs'
);

SELECT finish();

ROLLBACK;
```

### Step 3: supabase/tests/rls_storage.test.sql

```sql
-- supabase/tests/rls_storage.test.sql
BEGIN;

SELECT plan(4);

-- Vérifier que les buckets storage existent
SELECT ok(
  EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'dishes'),
  'Bucket dishes existe'
);

SELECT ok(
  EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'invoices'),
  'Bucket invoices existe'
);

-- Vérifier que les buckets ne sont pas publics (sauf dishes si public)
SELECT ok(
  (SELECT public FROM storage.buckets WHERE id = 'dishes') = true,
  'Bucket dishes est public (photos accessibles)'
);

SELECT ok(
  (SELECT public FROM storage.buckets WHERE id = 'invoices') = false,
  'Bucket invoices est privé (factures non publiques)'
);

SELECT finish();

ROLLBACK;
```

### Step 4: Configuration Supabase pgTAP local

```bash
# s'assurer que pgTAP est activé dans supabase/config.toml
[db]
# ... autres configs
```

```toml
# supabase/config.toml — vérifier
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

### Step 5: Exécution

```bash
# Lancer les tests localement
supabase start
supabase test db
# Attendu: all tests passed

# Dans GitHub Actions (cf. task-7-1.yml):
# - name: Run pgTAP tests
#   run: supabase test db
```

## Files to Create

- `supabase/tests/rls_isolation.test.sql`
- `supabase/tests/rls_immutability.test.sql`
- `supabase/tests/rls_storage.test.sql`

## Files to Modify

- Aucun — tests seulement

## Acceptance Criteria

- [ ] `supabase test db` → 100% tests verts
- [ ] 0 fuite de données inter-restaurant sur toutes les tables
- [ ] Immuabilité confirmée: temperature_logs UPDATE/DELETE rejetés
- [ ] Immuabilité confirmée: nettoyage_completions UPDATE rejeté
- [ ] Tests intégrés dans GitHub Actions job integration-tests
- [ ] Buckets storage correctement configurés (dishes public, invoices privé)

## Testing Protocol

```bash
# Local
supabase start
supabase db reset  # Appliquer migrations + seed
supabase test db   # Lancer pgTAP
```

```bash
# En CI (automatique via task-7-1.yml)
# Job integration-tests → supabase test db
```

## Git

- Branch: `phase-7/cicd`
- Commit message prefix: `Task 7.4:`

## PROGRESS.md Update

Marquer Task 7.4 ✅ dans PROGRESS.md.
