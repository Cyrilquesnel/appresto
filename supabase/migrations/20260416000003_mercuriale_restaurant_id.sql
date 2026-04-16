-- Migration: ajouter restaurant_id à mercuriale
-- Sécurise le RLS par colonne directe au lieu d'un JOIN sur ingredient_id

-- 1. Ajout colonne nullable d'abord (pour le backfill)
ALTER TABLE mercuriale
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 2. Backfill depuis restaurant_ingredients
UPDATE mercuriale m
SET restaurant_id = ri.restaurant_id
FROM restaurant_ingredients ri
WHERE m.ingredient_id = ri.id
  AND m.restaurant_id IS NULL;

-- 3. Supprimer les lignes orphelines (ingredient sans restaurant → ne devrait pas exister)
DELETE FROM mercuriale WHERE restaurant_id IS NULL;

-- 4. Contrainte NOT NULL + index
ALTER TABLE mercuriale ALTER COLUMN restaurant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mercuriale_restaurant_actif
  ON mercuriale(restaurant_id, est_actif);

-- 5. Refonte RLS : lookup direct sur restaurant_id (plus rapide, plus sûr)
DROP POLICY IF EXISTS "mercuriale_select" ON mercuriale;
DROP POLICY IF EXISTS "mercuriale_insert" ON mercuriale;
DROP POLICY IF EXISTS "mercuriale_update" ON mercuriale;
DROP POLICY IF EXISTS "mercuriale_delete" ON mercuriale;

CREATE POLICY "mercuriale_select" ON mercuriale
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "mercuriale_insert" ON mercuriale
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "mercuriale_update" ON mercuriale
  FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "mercuriale_delete" ON mercuriale
  FOR DELETE USING (restaurant_id = get_user_restaurant_id());
