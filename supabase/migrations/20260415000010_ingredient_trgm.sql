-- Phase 1 — pg_trgm foundation
-- Upgrades search_ingredients() from ILIKE to fuzzy similarity matching.
-- Prevents new duplicates: "chou rouge emince" now finds "Chou Rouge Émincé".

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigram index on nom_custom for fast similarity queries
-- Note: unaccent() is not IMMUTABLE so cannot be used in index expression.
-- The similarity queries still benefit from this index via pg_trgm.
CREATE INDEX IF NOT EXISTS idx_ri_nom_custom_trgm
  ON restaurant_ingredients
  USING GIN (nom_custom gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Replace search_ingredients():
-- restaurant_ingredients → similarity() instead of ILIKE
-- ingredients_catalog    → tsvector unchanged
CREATE OR REPLACE FUNCTION search_ingredients(
  p_query         TEXT,
  p_restaurant_id UUID,
  p_limit         INTEGER DEFAULT 20
)
RETURNS TABLE (id UUID, nom TEXT, source TEXT, allergenes TEXT[], score REAL) AS $$
DECLARE
  v_q TEXT := unaccent(lower(trim(p_query)));
BEGIN
  RETURN QUERY
  SELECT
    ri.id,
    COALESCE(ri.nom_custom, ic.nom)                               AS nom,
    'restaurant'::TEXT                                            AS source,
    COALESCE(ri.allergenes_override, ic.allergenes, '{}')         AS allergenes,
    GREATEST(
      similarity(unaccent(lower(COALESCE(ri.nom_custom, ''))), v_q),
      similarity(unaccent(lower(COALESCE(ic.nom,         ''))), v_q)
    )::REAL                                                       AS score
  FROM restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE ri.restaurant_id = p_restaurant_id
    AND ri.deleted_at IS NULL
    AND (
      similarity(unaccent(lower(COALESCE(ri.nom_custom, ''))), v_q) > 0.3
      OR similarity(unaccent(lower(COALESCE(ic.nom,         ''))), v_q) > 0.3
      -- ILIKE fallback for short queries (< 3 chars, trigram unreliable)
      OR unaccent(lower(COALESCE(ri.nom_custom, ''))) LIKE '%' || v_q || '%'
    )

  UNION ALL

  -- Catalog: tsvector full-text unchanged
  SELECT
    ic.id,
    ic.nom,
    'catalog'::TEXT,
    ic.allergenes,
    ts_rank(ic.search_vector, plainto_tsquery('french', p_query))::REAL
  FROM ingredients_catalog ic
  WHERE ic.search_vector @@ plainto_tsquery('french', p_query)
    AND ic.id NOT IN (
      SELECT catalog_id
      FROM   restaurant_ingredients
      WHERE  restaurant_id = p_restaurant_id
        AND  catalog_id IS NOT NULL
        AND  deleted_at IS NULL
    )

  ORDER BY source DESC, score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
