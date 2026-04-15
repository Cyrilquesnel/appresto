-- Migration 000014 : fiche_technique.ingredient_id devient NOT NULL
-- Backfill final des lignes sans ingredient_id, puis contrainte NOT NULL

-- Backfill : créer les restaurant_ingredients manquants depuis nom_ingredient
DO $$
DECLARE
  rec RECORD;
  new_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT restaurant_id, nom_ingredient
    FROM fiche_technique
    WHERE ingredient_id IS NULL
      AND nom_ingredient IS NOT NULL
      AND restaurant_id IS NOT NULL
  LOOP
    INSERT INTO restaurant_ingredients (restaurant_id, nom_custom)
    VALUES (rec.restaurant_id, rec.nom_ingredient)
    ON CONFLICT DO NOTHING
    RETURNING id INTO new_id;

    IF new_id IS NULL THEN
      SELECT id INTO new_id
      FROM restaurant_ingredients
      WHERE restaurant_id = rec.restaurant_id
        AND nom_custom = rec.nom_ingredient
      LIMIT 1;
    END IF;

    IF new_id IS NOT NULL THEN
      UPDATE fiche_technique
      SET ingredient_id = new_id
      WHERE restaurant_id = rec.restaurant_id
        AND nom_ingredient = rec.nom_ingredient
        AND ingredient_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Supprimer les lignes orphelines (pas de nom, pas d'ingredient_id)
DELETE FROM fiche_technique
WHERE ingredient_id IS NULL AND (nom_ingredient IS NULL OR nom_ingredient = '');

-- Contrainte NOT NULL
ALTER TABLE fiche_technique ALTER COLUMN ingredient_id SET NOT NULL;
