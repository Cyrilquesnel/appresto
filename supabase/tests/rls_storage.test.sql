-- rls_storage.test.sql
-- Tests RLS push_subscriptions : isolation par user_id (pas restaurant_id)
-- Un user ne peut voir/modifier que sa propre subscription
-- Exécuté via : supabase test db

BEGIN;

SELECT plan(10);

-- ══════════════════════════════════════════════
-- SETUP : 2 users dans le même restaurant
-- ══════════════════════════════════════════════

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('00000000-0000-0000-0021-000000000001'::uuid, 'owner@push.com', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0021-000000000002'::uuid, 'staff@push.com', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated');

INSERT INTO restaurants (id, nom, owner_id)
VALUES ('00000000-0000-0000-0022-000000000001'::uuid, 'Restaurant Push', '00000000-0000-0000-0021-000000000001'::uuid);

-- Les 2 users appartiennent au même restaurant
INSERT INTO restaurant_users (restaurant_id, user_id, role)
VALUES
  ('00000000-0000-0000-0022-000000000001'::uuid, '00000000-0000-0000-0021-000000000001'::uuid, 'owner'),
  ('00000000-0000-0000-0022-000000000001'::uuid, '00000000-0000-0000-0021-000000000002'::uuid, 'chef');

-- Subscription du owner
INSERT INTO push_subscriptions (id, user_id, restaurant_id, subscription)
VALUES (
  '00000000-0000-0000-0023-000000000001'::uuid,
  '00000000-0000-0000-0021-000000000001'::uuid,
  '00000000-0000-0000-0022-000000000001'::uuid,
  '{"endpoint":"https://fcm.example.com/owner","keys":{"p256dh":"key1","auth":"auth1"}}'::jsonb
);

-- ══════════════════════════════════════════════
-- TEST en tant que OWNER
-- ══════════════════════════════════════════════

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0021-000000000001","role":"authenticated"}', true);

-- 1. Owner voit sa propre subscription
SELECT is(
  (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid),
  1,
  'Owner voit sa propre push_subscription'
);

-- 2. Owner ne voit pas la subscription du staff (n'existe pas encore — mais la policy user_id = auth.uid() l'empêche de voir les autres)
SELECT is(
  (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000002'::uuid),
  0,
  'Owner ne voit pas la push_subscription du staff'
);

-- 3. Owner peut insérer sa propre subscription (UNIQUE contrainte — upsert via UPDATE)
SELECT lives_ok(
  $$UPDATE push_subscriptions
    SET subscription = '{"endpoint":"https://fcm.example.com/owner-updated","keys":{"p256dh":"key2","auth":"auth2"}}'::jsonb
    WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid$$,
  'Owner peut mettre à jour sa propre push_subscription'
);

-- 4. La mise à jour a bien eu lieu
SELECT like(
  (SELECT subscription->>'endpoint' FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid),
  '%owner-updated%',
  'La push_subscription du owner a bien été mise à jour'
);

-- ══════════════════════════════════════════════
-- TEST en tant que STAFF
-- ══════════════════════════════════════════════

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0021-000000000002","role":"authenticated"}', true);

-- 5. Staff ne voit pas la subscription du owner
SELECT is(
  (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid),
  0,
  'Staff ne voit pas la push_subscription du owner'
);

-- 6. Staff peut créer sa propre subscription
SELECT lives_ok(
  $$INSERT INTO push_subscriptions (id, user_id, restaurant_id, subscription)
    VALUES ('00000000-0000-0000-0023-000000000002'::uuid,
            '00000000-0000-0000-0021-000000000002'::uuid,
            '00000000-0000-0000-0022-000000000001'::uuid,
            '{"endpoint":"https://fcm.example.com/staff","keys":{"p256dh":"key3","auth":"auth3"}}'::jsonb)$$,
  'Staff peut créer sa propre push_subscription'
);

-- 7. Staff voit sa propre subscription
SELECT is(
  (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000002'::uuid),
  1,
  'Staff voit sa propre push_subscription'
);

-- 8. Staff ne peut pas modifier la subscription du owner
SELECT is(
  (WITH updated AS (
    UPDATE push_subscriptions
    SET subscription = '{"endpoint":"https://evil.com/hijack","keys":{"p256dh":"evil","auth":"evil"}}'::jsonb
    WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid
    RETURNING id
  ) SELECT COUNT(*)::int FROM updated),
  0,
  'Staff ne peut pas modifier la push_subscription du owner'
);

-- 9. Staff ne peut pas supprimer la subscription du owner
SELECT is(
  (WITH deleted AS (
    DELETE FROM push_subscriptions WHERE user_id = '00000000-0000-0000-0021-000000000001'::uuid RETURNING id
  ) SELECT COUNT(*)::int FROM deleted),
  0,
  'Staff ne peut pas supprimer la push_subscription du owner'
);

-- 10. La subscription du owner est intacte après les tentatives de Staff
SELECT like(
  (SELECT subscription->>'endpoint' FROM push_subscriptions WHERE id = '00000000-0000-0000-0023-000000000001'::uuid),
  '%owner-updated%',
  'La push_subscription du owner est intacte après attaques du staff'
);

SELECT * FROM finish();

ROLLBACK;
