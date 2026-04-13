-- Trigger cascade prix → coûts (async via pg_net)
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url', true) || '/recalculate-costs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_mercuriale_update
  AFTER INSERT OR UPDATE OF prix ON mercuriale
  FOR EACH ROW
  WHEN (NEW.est_actif = TRUE)
  EXECUTE FUNCTION trigger_recalculate_costs();

-- Fonction recherche ingrédients
CREATE OR REPLACE FUNCTION search_ingredients(
  p_query TEXT,
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (id UUID, nom TEXT, source TEXT, allergenes TEXT[], score REAL) AS $$
  SELECT ri.id, COALESCE(ri.nom_custom, ic.nom) AS nom, 'restaurant' AS source,
    COALESCE(ri.allergenes_override, ic.allergenes, '{}') AS allergenes, 1.0::REAL AS score
  FROM restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE ri.restaurant_id = p_restaurant_id AND ri.deleted_at IS NULL
    AND (ri.nom_custom ILIKE '%' || p_query || '%' OR ic.nom ILIKE '%' || p_query || '%')
  UNION ALL
  SELECT ic.id, ic.nom, 'catalog' AS source, ic.allergenes,
    ts_rank(ic.search_vector, plainto_tsquery('french', p_query)) AS score
  FROM ingredients_catalog ic
  WHERE ic.search_vector @@ plainto_tsquery('french', p_query)
    AND (p_restaurant_id IS NULL OR ic.id NOT IN (
      SELECT catalog_id FROM restaurant_ingredients
      WHERE restaurant_id = p_restaurant_id AND catalog_id IS NOT NULL
    ))
  ORDER BY source DESC, score DESC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
