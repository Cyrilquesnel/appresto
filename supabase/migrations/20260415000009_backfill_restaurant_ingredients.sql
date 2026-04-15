-- Backfill restaurant_ingredients depuis fiche_technique.nom_ingredient
-- Pour tous les ingrédients créés avant la liaison FK (ingredient_id = null)
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
    -- Crée l'ingrédient s'il n'existe pas déjà
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
