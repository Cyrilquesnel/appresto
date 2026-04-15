-- Phase 3 — Persistent supplier designation → ingredient mapping
-- After first confirmation, every subsequent invoice from the same supplier
-- is matched automatically with zero user interaction.

CREATE TABLE IF NOT EXISTS ingredient_supplier_mappings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_id    UUID        NOT NULL REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  fournisseur_id   UUID        REFERENCES fournisseurs(id) ON DELETE SET NULL,
  -- Raw designation as it appears on the invoice (used for exact lookup)
  designation_raw  TEXT        NOT NULL,
  -- Normalized for fuzzy lookup (unaccented, lowercased, trimmed)
  designation_norm TEXT        GENERATED ALWAYS AS (
    unaccent(lower(trim(designation_raw)))
  ) STORED,
  confirmed_by     UUID        REFERENCES auth.users(id),
  confirmed_at     TIMESTAMPTZ DEFAULT NOW(),
  usage_count      INTEGER     DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- One confirmed mapping per (restaurant, supplier, raw designation)
  -- NOTE: NULL != NULL in Postgres unique constraints — safe when fournisseur_id IS NULL
  CONSTRAINT uq_supplier_mapping UNIQUE (restaurant_id, fournisseur_id, designation_raw)
);

CREATE INDEX IF NOT EXISTS idx_ism_lookup
  ON ingredient_supplier_mappings (restaurant_id, designation_norm);

CREATE INDEX IF NOT EXISTS idx_ism_ingredient
  ON ingredient_supplier_mappings (ingredient_id);

ALTER TABLE ingredient_supplier_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ism_select" ON ingredient_supplier_mappings
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ism_insert" ON ingredient_supplier_mappings
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ism_update" ON ingredient_supplier_mappings
  FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ism_delete" ON ingredient_supplier_mappings
  FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- Helper: increment usage_count for confirmed mappings used in invoice matching
CREATE OR REPLACE FUNCTION increment_mapping_usage(
  p_restaurant_id  UUID,
  p_fournisseur_id UUID,
  p_designations   TEXT[]
)
RETURNS VOID AS $$
  UPDATE ingredient_supplier_mappings
  SET    usage_count = usage_count + 1
  WHERE  restaurant_id  = p_restaurant_id
    AND  fournisseur_id = p_fournisseur_id
    AND  designation_norm = ANY(p_designations);
$$ LANGUAGE sql SECURITY DEFINER;

-- Also update merge_ingredients() to re-point ingredient_supplier_mappings
CREATE OR REPLACE FUNCTION merge_ingredients(
  p_winner_id UUID,
  p_loser_id  UUID,
  p_user_id   UUID
)
RETURNS VOID AS $$
DECLARE
  v_restaurant_id  UUID;
  v_winner_nom     TEXT;
  v_loser_nom      TEXT;
  v_score          REAL;
BEGIN
  SELECT ri.restaurant_id, COALESCE(ri.nom_custom, ic.nom)
  INTO   v_restaurant_id, v_winner_nom
  FROM   restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE  ri.id = p_winner_id AND ri.deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Winner ingredient not found or already deleted: %', p_winner_id;
  END IF;

  SELECT COALESCE(ri.nom_custom, ic.nom)
  INTO   v_loser_nom
  FROM   restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE  ri.id = p_loser_id
    AND  ri.restaurant_id = v_restaurant_id
    AND  ri.deleted_at IS NULL;

  IF v_loser_nom IS NULL THEN
    RAISE EXCEPTION 'Loser ingredient not found, wrong restaurant, or already deleted: %', p_loser_id;
  END IF;

  v_score := similarity(unaccent(lower(v_winner_nom)), unaccent(lower(v_loser_nom)));

  UPDATE fiche_technique                SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE mercuriale                     SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE bon_de_commande_lignes         SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE inventaire_reel                SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE ingredient_supplier_mappings   SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE restaurant_ingredients         SET deleted_at = NOW()           WHERE id = p_loser_id;

  INSERT INTO ingredient_merge_log
    (restaurant_id, kept_id, merged_id, kept_nom, merged_nom, similarity_score, merged_by)
  VALUES
    (v_restaurant_id, p_winner_id, p_loser_id, v_winner_nom, v_loser_nom, v_score, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
