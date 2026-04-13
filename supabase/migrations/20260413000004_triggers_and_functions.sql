-- Activer pg_net pour les appels HTTP asynchrones depuis les triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger cascade prix → coûts (async via pg_net, non-bloquant)
-- app.edge_function_url et app.service_role_key doivent être configurés :
--   En dev local : ALTER DATABASE postgres SET app.edge_function_url = 'http://localhost:54321/functions/v1';
--                  ALTER DATABASE postgres SET app.service_role_key = '<local-anon-key>';
--   En production : utiliser Supabase Vault (vault.secrets)
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url', true) || '/recalculate-costs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    -- body doit être TEXT pour pg_net
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix
    )::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la transaction mercuriale même si pg_net échoue
  RAISE WARNING '[trigger_recalculate_costs] Erreur pg_net: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_mercuriale_update ON mercuriale;
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
