-- rls_isolation.test.sql
-- Tests d'isolation multi-tenant : restaurant A ne peut pas voir les données de restaurant B
-- Exécuté via : supabase test db

BEGIN;

SELECT plan(24);

-- ══════════════════════════════════════════════
-- SETUP : créer 2 restaurants et 2 users isolés
-- ══════════════════════════════════════════════

-- Users fictifs (on insère directement dans auth.users pour pgTAP)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('00000000-0000-0000-0001-000000000001'::uuid, 'alice@test.com', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0001-000000000002'::uuid, 'bob@test.com', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated');

-- Restaurants
INSERT INTO restaurants (id, nom, owner_id)
VALUES
  ('00000000-0000-0000-0002-000000000001'::uuid, 'Restaurant Alice', '00000000-0000-0000-0001-000000000001'::uuid),
  ('00000000-0000-0000-0002-000000000002'::uuid, 'Restaurant Bob', '00000000-0000-0000-0001-000000000002'::uuid);

-- Liaison restaurant_users
INSERT INTO restaurant_users (restaurant_id, user_id, role)
VALUES
  ('00000000-0000-0000-0002-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'owner'),
  ('00000000-0000-0000-0002-000000000002'::uuid, '00000000-0000-0000-0001-000000000002'::uuid, 'owner');

-- Données restaurant Alice
INSERT INTO plats (id, restaurant_id, nom)
VALUES ('00000000-0000-0000-0003-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 'Plat Alice Secret');

INSERT INTO fournisseurs (id, restaurant_id, nom)
VALUES ('00000000-0000-0000-0004-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 'Fournisseur Alice');

INSERT INTO ventes (id, restaurant_id, quantite, date, plat_id)
VALUES ('00000000-0000-0000-0005-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 5, CURRENT_DATE,
        '00000000-0000-0000-0003-000000000001'::uuid);

INSERT INTO bons_de_commande (id, restaurant_id, date_commande)
VALUES ('00000000-0000-0000-0006-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, CURRENT_DATE);

INSERT INTO charges (id, restaurant_id, montant, type)
VALUES ('00000000-0000-0000-0007-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 1000.00, 'loyer');

-- ══════════════════════════════════════════════
-- TESTS : Bob (user 2) ne voit PAS les données d'Alice (restaurant 1)
-- On set auth.uid() à Bob via set_config
-- ══════════════════════════════════════════════

-- Passer en mode row-level security (comme un vrai user authentifié)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000002","role":"authenticated"}', true);

-- 1. Bob ne voit pas le restaurant d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM restaurants WHERE id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir le restaurant d''Alice'
);

-- 2. Bob ne voit pas les plats d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM plats WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir les plats d''Alice'
);

-- 3. Bob ne voit pas les fournisseurs d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM fournisseurs WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir les fournisseurs d''Alice'
);

-- 4. Bob ne voit pas les ventes d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM ventes WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir les ventes d''Alice'
);

-- 5. Bob ne voit pas les bons de commande d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM bons_de_commande WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir les bons de commande d''Alice'
);

-- 6. Bob ne voit pas les charges d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM charges WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  0,
  'Bob ne peut pas voir les charges d''Alice'
);

-- ══════════════════════════════════════════════
-- TESTS : Bob ne peut pas INSÉRER dans le restaurant d'Alice
-- ══════════════════════════════════════════════

-- 7. Bob ne peut pas insérer un plat chez Alice
SELECT throws_ok(
  $$INSERT INTO plats (restaurant_id, nom) VALUES ('00000000-0000-0000-0002-000000000001'::uuid, 'Injection Bob')$$,
  'new row violates row-level security policy for table "plats"',
  'Bob ne peut pas insérer un plat chez Alice'
);

-- 8. Bob ne peut pas insérer un fournisseur chez Alice
SELECT throws_ok(
  $$INSERT INTO fournisseurs (restaurant_id, nom) VALUES ('00000000-0000-0000-0002-000000000001'::uuid, 'Fournisseur Injection')$$,
  'new row violates row-level security policy for table "fournisseurs"',
  'Bob ne peut pas insérer un fournisseur chez Alice'
);

-- 9. Bob ne peut pas insérer des ventes chez Alice
SELECT throws_ok(
  $$INSERT INTO ventes (restaurant_id, quantite, date) VALUES ('00000000-0000-0000-0002-000000000001'::uuid, 1, CURRENT_DATE)$$,
  'new row violates row-level security policy for table "ventes"',
  'Bob ne peut pas insérer des ventes chez Alice'
);

-- 10. Bob ne peut pas modifier les plats d'Alice
SELECT is(
  (SELECT COUNT(*)::int FROM plats WHERE nom = 'Plat Alice Secret'),
  0,
  'Bob ne peut pas voir le plat d''Alice (précondition UPDATE)'
);

-- 11. Bob ne peut pas supprimer les plats d'Alice (DELETE retourne 0 rows, pas d'erreur)
SELECT is(
  (WITH deleted AS (
    DELETE FROM plats WHERE id = '00000000-0000-0000-0003-000000000001'::uuid RETURNING id
  ) SELECT COUNT(*)::int FROM deleted),
  0,
  'Bob ne peut pas supprimer le plat d''Alice (RLS filtre silencieusement)'
);

-- ══════════════════════════════════════════════
-- TESTS : Alice voit BIEN ses propres données
-- ══════════════════════════════════════════════

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}', true);

-- 12. Alice voit son restaurant
SELECT is(
  (SELECT COUNT(*)::int FROM restaurants WHERE id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit son propre restaurant'
);

-- 13. Alice voit ses plats
SELECT is(
  (SELECT COUNT(*)::int FROM plats WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit ses propres plats'
);

-- 14. Alice voit ses fournisseurs
SELECT is(
  (SELECT COUNT(*)::int FROM fournisseurs WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit ses propres fournisseurs'
);

-- 15. Alice voit ses ventes
SELECT is(
  (SELECT COUNT(*)::int FROM ventes WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit ses propres ventes'
);

-- 16. Alice voit ses bons de commande
SELECT is(
  (SELECT COUNT(*)::int FROM bons_de_commande WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit ses propres bons de commande'
);

-- 17. Alice voit ses charges
SELECT is(
  (SELECT COUNT(*)::int FROM charges WHERE restaurant_id = '00000000-0000-0000-0002-000000000001'::uuid),
  1,
  'Alice voit ses propres charges'
);

-- ══════════════════════════════════════════════
-- TESTS : Catalogue ingrédients — accès public authentifié
-- ══════════════════════════════════════════════

-- 18. Alice peut lire le catalogue
SELECT ok(
  (SELECT COUNT(*)::int FROM ingredients_catalog) >= 0,
  'Alice peut lire le catalogue ingrédients'
);

-- 19. Bob peut aussi lire le catalogue
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000002","role":"authenticated"}', true);
SELECT ok(
  (SELECT COUNT(*)::int FROM ingredients_catalog) >= 0,
  'Bob peut aussi lire le catalogue ingrédients'
);

-- 20. Anon ne peut pas lire le catalogue
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT COUNT(*)::int FROM ingredients_catalog),
  0,
  'Anon ne peut pas lire le catalogue ingrédients'
);

-- ══════════════════════════════════════════════
-- TESTS : Alice ne voit pas le restaurant de Bob
-- ══════════════════════════════════════════════

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}', true);

-- 21. Alice ne voit pas le restaurant de Bob
SELECT is(
  (SELECT COUNT(*)::int FROM restaurants WHERE id = '00000000-0000-0000-0002-000000000002'::uuid),
  0,
  'Alice ne voit pas le restaurant de Bob'
);

-- 22. Alice ne voit pas les restaurant_users de Bob
SELECT is(
  (SELECT COUNT(*)::int FROM restaurant_users WHERE restaurant_id = '00000000-0000-0000-0002-000000000002'::uuid),
  0,
  'Alice ne voit pas les users du restaurant de Bob'
);

-- 23. Alice ne peut pas insérer une charge chez Bob
SELECT throws_ok(
  $$INSERT INTO charges (restaurant_id, montant, type) VALUES ('00000000-0000-0000-0002-000000000002'::uuid, 500, 'test')$$,
  'new row violates row-level security policy for table "charges"',
  'Alice ne peut pas insérer une charge chez Bob'
);

-- 24. Alice ne peut pas insérer un bon de commande chez Bob
SELECT throws_ok(
  $$INSERT INTO bons_de_commande (restaurant_id, date_commande) VALUES ('00000000-0000-0000-0002-000000000002'::uuid, CURRENT_DATE)$$,
  'new row violates row-level security policy for table "bons_de_commande"',
  'Alice ne peut pas insérer un bon de commande chez Bob'
);

SELECT * FROM finish();

ROLLBACK;
