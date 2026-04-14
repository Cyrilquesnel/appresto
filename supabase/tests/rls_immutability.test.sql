-- rls_immutability.test.sql
-- Tests d'immuabilité HACCP : temperature_logs et nettoyage_completions
-- sont INSERT-ONLY (PAS de UPDATE ni DELETE) — conformité légale
-- Exécuté via : supabase test db

BEGIN;

SELECT plan(12);

-- ══════════════════════════════════════════════
-- SETUP
-- ══════════════════════════════════════════════

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-0000-0011-000000000001'::uuid, 'chef@haccp.com', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated');

INSERT INTO restaurants (id, nom, owner_id)
VALUES ('00000000-0000-0000-0012-000000000001'::uuid, 'Restaurant HACCP', '00000000-0000-0000-0011-000000000001'::uuid);

INSERT INTO restaurant_users (restaurant_id, user_id, role)
VALUES ('00000000-0000-0000-0012-000000000001'::uuid, '00000000-0000-0000-0011-000000000001'::uuid, 'owner');

-- Équipement (type = 'frigo' selon le CHECK constraint)
INSERT INTO equipements (id, restaurant_id, nom, type)
VALUES ('00000000-0000-0000-0013-000000000001'::uuid, '00000000-0000-0000-0012-000000000001'::uuid, 'Frigo 1', 'frigo');

-- Checklist (type = 'pre_service' selon le CHECK constraint)
INSERT INTO nettoyage_checklists (id, restaurant_id, nom, type)
VALUES ('00000000-0000-0000-0014-000000000001'::uuid, '00000000-0000-0000-0012-000000000001'::uuid, 'Nettoyage cuisine', 'pre_service');

-- Passer en user authentifié
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0011-000000000001","role":"authenticated"}', true);

-- ══════════════════════════════════════════════
-- TEMPERATURE_LOGS — INSERT OK
-- ══════════════════════════════════════════════

-- 1. INSERT temperature_log autorisé (colonne = valeur, auteur_id)
SELECT lives_ok(
  $$INSERT INTO temperature_logs (id, restaurant_id, equipement_id, valeur, auteur_id)
    VALUES ('00000000-0000-0000-0015-000000000001'::uuid,
            '00000000-0000-0000-0012-000000000001'::uuid,
            '00000000-0000-0000-0013-000000000001'::uuid,
            4.5,
            '00000000-0000-0000-0011-000000000001'::uuid)$$,
  'INSERT temperature_log autorisé pour le restaurant du user'
);

-- 2. SELECT temperature_log autorisé
SELECT is(
  (SELECT COUNT(*)::int FROM temperature_logs WHERE id = '00000000-0000-0000-0015-000000000001'::uuid),
  1,
  'SELECT temperature_log autorisé'
);

-- ══════════════════════════════════════════════
-- TEMPERATURE_LOGS — UPDATE / DELETE BLOQUÉS
-- ══════════════════════════════════════════════

-- 3. UPDATE temperature_log bloqué (pas de policy UPDATE → 0 rows affectées)
SELECT is(
  (WITH updated AS (
    UPDATE temperature_logs SET valeur = 99.0
    WHERE id = '00000000-0000-0000-0015-000000000001'::uuid
    RETURNING id
  ) SELECT COUNT(*)::int FROM updated),
  0,
  'UPDATE temperature_log bloqué par absence de policy UPDATE'
);

-- 4. Vérifier que la valeur n'a pas changé
SELECT is(
  (SELECT valeur FROM temperature_logs WHERE id = '00000000-0000-0000-0015-000000000001'::uuid),
  4.5::numeric,
  'La valeur n''a pas été modifiée (UPDATE silencieusement ignoré)'
);

-- 5. DELETE temperature_log bloqué (pas de policy DELETE → 0 rows affectées)
SELECT is(
  (WITH deleted AS (
    DELETE FROM temperature_logs WHERE id = '00000000-0000-0000-0015-000000000001'::uuid RETURNING id
  ) SELECT COUNT(*)::int FROM deleted),
  0,
  'DELETE temperature_log bloqué par absence de policy DELETE'
);

-- 6. Le log existe encore après tentative de DELETE
SELECT is(
  (SELECT COUNT(*)::int FROM temperature_logs WHERE id = '00000000-0000-0000-0015-000000000001'::uuid),
  1,
  'Le temperature_log existe encore après tentative de suppression'
);

-- ══════════════════════════════════════════════
-- NETTOYAGE_COMPLETIONS — INSERT OK
-- ══════════════════════════════════════════════

-- 7. INSERT nettoyage_completion autorisé
SELECT lives_ok(
  $$INSERT INTO nettoyage_completions (id, restaurant_id, checklist_id, auteur_id)
    VALUES ('00000000-0000-0000-0016-000000000001'::uuid,
            '00000000-0000-0000-0012-000000000001'::uuid,
            '00000000-0000-0000-0014-000000000001'::uuid,
            '00000000-0000-0000-0011-000000000001'::uuid)$$,
  'INSERT nettoyage_completion autorisé'
);

-- 8. SELECT nettoyage_completion autorisé
SELECT is(
  (SELECT COUNT(*)::int FROM nettoyage_completions WHERE id = '00000000-0000-0000-0016-000000000001'::uuid),
  1,
  'SELECT nettoyage_completion autorisé'
);

-- ══════════════════════════════════════════════
-- NETTOYAGE_COMPLETIONS — UPDATE / DELETE BLOQUÉS
-- ══════════════════════════════════════════════

-- 9. UPDATE nettoyage_completion bloqué (changer signature_url)
SELECT is(
  (WITH updated AS (
    UPDATE nettoyage_completions SET signature_url = 'https://falsified.com/fake.png'
    WHERE id = '00000000-0000-0000-0016-000000000001'::uuid
    RETURNING id
  ) SELECT COUNT(*)::int FROM updated),
  0,
  'UPDATE nettoyage_completion bloqué par absence de policy UPDATE'
);

-- 10. La signature_url n'a pas changé
SELECT is(
  (SELECT signature_url FROM nettoyage_completions WHERE id = '00000000-0000-0000-0016-000000000001'::uuid),
  NULL,
  'La signature_url n''a pas été modifiée (UPDATE ignoré)'
);

-- 11. DELETE nettoyage_completion bloqué
SELECT is(
  (WITH deleted AS (
    DELETE FROM nettoyage_completions WHERE id = '00000000-0000-0000-0016-000000000001'::uuid RETURNING id
  ) SELECT COUNT(*)::int FROM deleted),
  0,
  'DELETE nettoyage_completion bloqué par absence de policy DELETE'
);

-- 12. La completion existe encore après tentative de DELETE
SELECT is(
  (SELECT COUNT(*)::int FROM nettoyage_completions WHERE id = '00000000-0000-0000-0016-000000000001'::uuid),
  1,
  'La nettoyage_completion existe encore après tentative de suppression'
);

SELECT * FROM finish();

ROLLBACK;
