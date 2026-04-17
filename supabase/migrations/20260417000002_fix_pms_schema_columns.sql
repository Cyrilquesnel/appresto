-- Migration: alignement schéma PMS avec le code
-- Ajoute les colonnes manquantes dans temperature_logs, receptions,
-- reception_items, haccp_points_critiques et rappel_alerts

-- ─────────────────────────────────────────────
-- temperature_logs : conforme + timestamp_releve + releve_par
-- ─────────────────────────────────────────────
ALTER TABLE temperature_logs
  ADD COLUMN IF NOT EXISTS conforme BOOLEAN,
  ADD COLUMN IF NOT EXISTS timestamp_releve TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS releve_par UUID REFERENCES auth.users(id);

-- Backfill timestamp_releve depuis created_at pour les lignes existantes
UPDATE temperature_logs
SET timestamp_releve = created_at
WHERE timestamp_releve IS NULL;

CREATE INDEX IF NOT EXISTS idx_temp_logs_timestamp ON temperature_logs(restaurant_id, timestamp_releve DESC);

-- ─────────────────────────────────────────────
-- receptions : renommer date → date_reception + numero_bl + receptionne_par
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receptions' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receptions' AND column_name = 'date_reception'
  ) THEN
    ALTER TABLE receptions RENAME COLUMN date TO date_reception;
  END IF;
END $$;

ALTER TABLE receptions
  ADD COLUMN IF NOT EXISTS numero_bl TEXT,
  ADD COLUMN IF NOT EXISTS receptionne_par UUID REFERENCES auth.users(id);

-- ─────────────────────────────────────────────
-- reception_items : restaurant_id + nom_produit
-- ─────────────────────────────────────────────
ALTER TABLE reception_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS nom_produit TEXT;

-- ─────────────────────────────────────────────
-- haccp_points_critiques : colonnes enrichies pour la génération IA
-- ─────────────────────────────────────────────
ALTER TABLE haccp_points_critiques
  ADD COLUMN IF NOT EXISTS ccp_numero TEXT,
  ADD COLUMN IF NOT EXISTS etape_critique TEXT,
  ADD COLUMN IF NOT EXISTS plat_nom TEXT,
  ADD COLUMN IF NOT EXISTS limite_critique TEXT,
  ADD COLUMN IF NOT EXISTS mesure_surveillance TEXT,
  ADD COLUMN IF NOT EXISTS verification TEXT,
  ADD COLUMN IF NOT EXISTS genere_le TIMESTAMPTZ;

-- ─────────────────────────────────────────────
-- rappel_alerts : colonnes RappelConso enrichies
-- ─────────────────────────────────────────────
ALTER TABLE rappel_alerts
  ADD COLUMN IF NOT EXISTS traite BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS traite_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nom_produit TEXT,
  ADD COLUMN IF NOT EXISTS nom_marque TEXT,
  ADD COLUMN IF NOT EXISTS motif TEXT,
  ADD COLUMN IF NOT EXISTS risques TEXT,
  ADD COLUMN IF NOT EXISTS date_rappel DATE,
  ADD COLUMN IF NOT EXISTS lien_info TEXT,
  ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES restaurant_ingredients(id);
