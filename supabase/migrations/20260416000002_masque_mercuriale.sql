-- Ajoute le flag masque_mercuriale sur restaurant_ingredients
-- Permet de cacher un ingrédient de la mercuriale sans le supprimer des fiches recettes

ALTER TABLE restaurant_ingredients
  ADD COLUMN IF NOT EXISTS masque_mercuriale BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_restaurant_ingredients_masque
  ON restaurant_ingredients(restaurant_id, masque_mercuriale)
  WHERE deleted_at IS NULL;
