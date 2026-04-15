-- Migration 000013 : Beta analytics — sessions + limite 20 testeurs + rapport quotidien

-- 1. Table de suivi des sessions beta (durée + pages visitées)
CREATE TABLE IF NOT EXISTS beta_sessions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID         NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id           UUID         NOT NULL,
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_active_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  pages_visited     TEXT[]       DEFAULT '{}',
  duration_seconds  INTEGER      GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (last_active_at - started_at))::INTEGER
  ) STORED,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE beta_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_sessions_own"
  ON beta_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_beta_sessions_restaurant ON beta_sessions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_beta_sessions_started    ON beta_sessions(started_at);

-- 2. Trigger — bloque toute inscription au-delà de 20 restaurants beta
CREATE OR REPLACE FUNCTION check_beta_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM restaurants WHERE deleted_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'BETA_FULL: Maximum 20 restaurants pendant la période beta';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_beta_limit ON restaurants;
CREATE TRIGGER enforce_beta_limit
  BEFORE INSERT ON restaurants
  FOR EACH ROW EXECUTE FUNCTION check_beta_limit();

-- 3. Fonction publique (anon) pour vérifier si la beta est ouverte
CREATE OR REPLACE FUNCTION is_beta_open()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*) < 20 FROM restaurants WHERE deleted_at IS NULL;
$$;

-- 4. Fonction de stats journalières pour le rapport cron (service role uniquement)
CREATE OR REPLACE FUNCTION get_beta_stats(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
  restaurant_id         UUID,
  restaurant_nom        TEXT,
  restaurant_created_at TIMESTAMPTZ,
  owner_id              UUID,
  sessions_count        BIGINT,
  avg_session_min       NUMERIC,
  total_events_count    BIGINT,
  feature_counts        JSONB,
  error_count           BIGINT
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH event_agg AS (
    SELECT
      e.restaurant_id,
      COUNT(*)                                                        AS total,
      jsonb_object_agg(e.type, e.cnt)                                 AS by_type,
      SUM(CASE WHEN e.type = 'error' THEN e.cnt ELSE 0 END)          AS errors
    FROM (
      SELECT restaurant_id, type, COUNT(*) AS cnt
      FROM   events
      WHERE  created_at >= now() - (p_hours || ' hours')::INTERVAL
      GROUP  BY restaurant_id, type
    ) e
    GROUP BY e.restaurant_id
  ),
  session_agg AS (
    SELECT
      restaurant_id,
      COUNT(*)                                   AS sessions,
      COALESCE(AVG(duration_seconds), 0) / 60.0 AS avg_min
    FROM beta_sessions
    WHERE started_at >= now() - (p_hours || ' hours')::INTERVAL
    GROUP BY restaurant_id
  )
  SELECT
    r.id,
    r.nom,
    r.created_at,
    r.owner_id,
    COALESCE(sa.sessions, 0),
    ROUND(COALESCE(sa.avg_min, 0), 1),
    COALESCE(ea.total, 0),
    COALESCE(ea.by_type, '{}'::jsonb),
    COALESCE(ea.errors, 0)
  FROM       restaurants  r
  LEFT JOIN  event_agg    ea ON ea.restaurant_id = r.id
  LEFT JOIN  session_agg  sa ON sa.restaurant_id = r.id
  WHERE r.deleted_at IS NULL
  ORDER BY r.created_at;
$$;
