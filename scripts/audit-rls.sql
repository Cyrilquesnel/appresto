-- scripts/audit-rls.sql
-- Vérifie que toutes les tables applicatives ont RLS activé.
-- Usage : psql $SUPABASE_DB_URL -f scripts/audit-rls.sql
-- Retourne exit code 1 si des tables sans RLS sont trouvées.

\set ON_ERROR_STOP on

WITH app_tables AS (
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN (
      -- Tables système Supabase gérées hors app
      'schema_migrations',
      'spatial_ref_sys'
    )
),
rls_status AS (
  SELECT
    t.tablename,
    c.relrowsecurity AS rls_enabled
  FROM app_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
)
SELECT tablename, rls_enabled
FROM rls_status
ORDER BY rls_enabled, tablename;

-- Assertion : aucune table sans RLS
DO $$
DECLARE
  tables_without_rls TEXT;
BEGIN
  SELECT string_agg(tablename, ', ')
  INTO tables_without_rls
  FROM (
    SELECT t.tablename
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE t.schemaname = 'public'
      AND NOT c.relrowsecurity
      AND t.tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
  ) sub;

  IF tables_without_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tables sans RLS détectées : %', tables_without_rls;
  END IF;

  RAISE NOTICE '✅ Toutes les tables ont RLS activé';
END;
$$;
