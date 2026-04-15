-- Phase 2 — One-shot deduplication of existing duplicate ingredients
-- Creates audit log, detect function, and atomic merge function.
-- merge_ingredients() re-points all FK references before soft-deleting the loser.

-- ── Audit log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_merge_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  kept_id          UUID        NOT NULL REFERENCES restaurant_ingredients(id),
  merged_id        UUID        NOT NULL,   -- soft-deleted, FK no longer valid
  kept_nom         TEXT        NOT NULL,
  merged_nom       TEXT        NOT NULL,
  similarity_score REAL,
  merged_by        UUID        REFERENCES auth.users(id),
  merged_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ingredient_merge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merge_log_select" ON ingredient_merge_log;
CREATE POLICY "merge_log_select" ON ingredient_merge_log
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

DROP POLICY IF EXISTS "merge_log_insert" ON ingredient_merge_log;
CREATE POLICY "merge_log_insert" ON ingredient_merge_log
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE INDEX IF NOT EXISTS idx_merge_log_restaurant
  ON ingredient_merge_log (restaurant_id, merged_at DESC);

-- ── detect_ingredient_duplicates() ───────────────────────────────────────────
-- Returns pairs of probable duplicates (similarity >= p_threshold).
-- Requires pg_trgm from migration 000010.
CREATE OR REPLACE FUNCTION detect_ingredient_duplicates(
  p_restaurant_id UUID,
  p_threshold     REAL DEFAULT 0.65
)
RETURNS TABLE (
  id_a  UUID,
  nom_a TEXT,
  id_b  UUID,
  nom_b TEXT,
  score REAL
) AS $$
  SELECT
    a.id,
    COALESCE(a.nom_custom, ica.nom)                                          AS nom_a,
    b.id,
    COALESCE(b.nom_custom, icb.nom)                                          AS nom_b,
    similarity(
      unaccent(lower(COALESCE(a.nom_custom, ica.nom, ''))),
      unaccent(lower(COALESCE(b.nom_custom, icb.nom, '')))
    )::REAL                                                                  AS score
  FROM restaurant_ingredients a
  JOIN restaurant_ingredients b
    ON a.restaurant_id = b.restaurant_id
   AND a.id < b.id   -- avoid (B,A) symmetrical pair
  LEFT JOIN ingredients_catalog ica ON a.catalog_id = ica.id
  LEFT JOIN ingredients_catalog icb ON b.catalog_id = icb.id
  WHERE a.restaurant_id = p_restaurant_id
    AND a.deleted_at IS NULL
    AND b.deleted_at IS NULL
    AND similarity(
          unaccent(lower(COALESCE(a.nom_custom, ica.nom, ''))),
          unaccent(lower(COALESCE(b.nom_custom, icb.nom, '')))
        ) >= p_threshold
    -- Skip pairs already merged (either direction)
    AND NOT EXISTS (
      SELECT 1 FROM ingredient_merge_log ml
      WHERE ml.restaurant_id = p_restaurant_id
        AND ((ml.kept_id = a.id AND ml.merged_id = b.id)
          OR (ml.kept_id = b.id AND ml.merged_id = a.id))
    )
  ORDER BY score DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── merge_ingredients() ───────────────────────────────────────────────────────
-- Atomically re-points all FK references from loser → winner, then soft-deletes loser.
-- All operations run inside the implicit PL/pgSQL transaction — any failure rolls back.
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
  -- Validate winner belongs to this restaurant and is not deleted
  SELECT ri.restaurant_id, COALESCE(ri.nom_custom, ic.nom)
  INTO   v_restaurant_id, v_winner_nom
  FROM   restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE  ri.id = p_winner_id
    AND  ri.deleted_at IS NULL;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Winner ingredient not found or already deleted: %', p_winner_id;
  END IF;

  -- Validate loser belongs to same restaurant and is not deleted
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

  -- Re-point all FK references
  UPDATE fiche_technique        SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE mercuriale             SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE bon_de_commande_lignes SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;
  UPDATE inventaire_reel        SET ingredient_id = p_winner_id WHERE ingredient_id = p_loser_id;

  -- Soft-delete loser
  UPDATE restaurant_ingredients SET deleted_at = NOW() WHERE id = p_loser_id;

  -- Audit
  INSERT INTO ingredient_merge_log
    (restaurant_id, kept_id, merged_id, kept_nom, merged_nom, similarity_score, merged_by)
  VALUES
    (v_restaurant_id, p_winner_id, p_loser_id, v_winner_nom, v_loser_nom, v_score, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
