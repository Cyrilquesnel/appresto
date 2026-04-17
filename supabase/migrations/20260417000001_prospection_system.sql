-- ============================================================
-- SYSTÈME DE PROSPECTION AUTOMATISÉE — Le Rush / Onrush
-- Pipeline WhatsApp B2B : scraping → scoring → outreach → nurturing
-- ============================================================

-- Table principale : leads prospects
CREATE TABLE IF NOT EXISTS prospects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id     TEXT UNIQUE,
  nom                 TEXT NOT NULL,
  telephone           TEXT,
  email               TEXT,
  website             TEXT,
  adresse             JSONB,
  ville               TEXT,
  code_postal         TEXT,
  score               INTEGER CHECK (score BETWEEN 0 AND 100),
  score_breakdown     JSONB,
  rating              DECIMAL(2,1),
  reviews_count       INTEGER,
  menu_snippet        TEXT,
  type_cuisine        TEXT,
  statut              TEXT NOT NULL DEFAULT 'new'
                        CHECK (statut IN ('new','contacted','replied','demo','client','dead')),
  whatsapp_sent_at    TIMESTAMPTZ,
  whatsapp_message_id TEXT,
  linkedin_sent_at    TIMESTAMPTZ,
  last_reply_at       TIMESTAMPTZ,
  last_reply_text     TEXT,
  unsubscribed_at     TIMESTAMPTZ,
  intent              TEXT CHECK (intent IN ('hot','warm','cold','unsubscribe')),
  intent_confidence   DECIMAL(3,2),
  notes               TEXT,
  source              TEXT NOT NULL DEFAULT 'google_maps',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages nurturing schedulés (follow-ups automatiques)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  send_at          TIMESTAMPTZ NOT NULL,
  template_key     TEXT NOT NULL,
  personalization  JSONB DEFAULT '{}',
  sent_at          TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','staged','sent','failed')),
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calendrier contenu généré par CronCreate
CREATE TABLE IF NOT EXISTS content_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN ('instagram','tiktok','linkedin','youtube')),
  content_type  TEXT NOT NULL,
  content_text  TEXT NOT NULL,
  script        TEXT,
  hashtags      TEXT[],
  publish_date  DATE NOT NULL,
  published_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','published','rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_prospects_statut         ON prospects(statut);
CREATE INDEX IF NOT EXISTS idx_prospects_score          ON prospects(score DESC) WHERE score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_whatsapp_null  ON prospects(created_at) WHERE whatsapp_sent_at IS NULL AND statut = 'new';
CREATE INDEX IF NOT EXISTS idx_prospects_unsub          ON prospects(unsubscribed_at) WHERE unsubscribed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_send_at        ON scheduled_messages(send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_content_calendar_date    ON content_calendar(publish_date, platform);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_prospects_updated_at();

-- ============================================================
-- VUE : STATS HEBDOMADAIRES DE PROSPECTION
-- ============================================================

CREATE OR REPLACE VIEW prospection_weekly_stats AS
SELECT
  DATE_TRUNC('week', created_at)                                          AS week,
  COUNT(*)                                                                AS total_leads,
  COUNT(*) FILTER (WHERE statut = 'contacted')                           AS contacts_sent,
  COUNT(*) FILTER (WHERE statut IN ('replied','demo','client'))          AS replies,
  ROUND(
    COUNT(*) FILTER (WHERE statut IN ('replied','demo','client'))::numeric /
    NULLIF(COUNT(*) FILTER (WHERE statut = 'contacted'), 0) * 100, 1
  )                                                                       AS reply_rate_pct,
  COUNT(*) FILTER (WHERE statut = 'demo')                                AS demos_booked,
  COUNT(*) FILTER (WHERE statut = 'client')                              AS conversions,
  COUNT(*) FILTER (WHERE intent = 'hot')                                 AS hot_leads,
  COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)                    AS unsubscribes,
  ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 0)                  AS avg_lead_score
FROM prospects
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- ============================================================
-- FONCTION : ANONYMISATION RGPD (cron mensuel)
-- Supprime les données PII des prospects dead depuis > 3 ans
-- ============================================================

CREATE OR REPLACE FUNCTION anonymize_old_prospects()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE prospects SET
    nom            = '[Anonymisé]',
    telephone      = NULL,
    email          = NULL,
    website        = NULL,
    menu_snippet   = NULL,
    last_reply_text = NULL,
    notes          = NULL
  WHERE statut = 'dead'
    AND unsubscribed_at < NOW() - INTERVAL '3 years'
    AND nom != '[Anonymisé]';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ============================================================
-- NOTE : Pas de RLS sur prospects — table admin uniquement
-- accessible via service_role (crons) ou INTERNAL_CRON_KEY
-- JAMAIS exposée aux restaurants clients
-- ============================================================
