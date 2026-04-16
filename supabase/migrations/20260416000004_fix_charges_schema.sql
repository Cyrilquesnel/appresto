-- Migration: restructure table charges
-- La table initiale avait un schéma générique (type, montant, frequence)
-- Le code tRPC attend des colonnes spécifiques par poste budgétaire + mois

-- Supprimer l'ancienne table (vide en prod, aucune donnée réelle)
DROP TABLE IF EXISTS charges CASCADE;

-- Recréer avec le bon schéma
CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  mois TEXT NOT NULL, -- format YYYY-MM, ex: '2026-04'
  masse_salariale DECIMAL(10,2),
  loyer DECIMAL(10,2),
  energie DECIMAL(10,2),
  assurances DECIMAL(10,2),
  autres_charges DECIMAL(10,2),
  charges_fixes_total DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(loyer, 0) + COALESCE(energie, 0) + COALESCE(assurances, 0) + COALESCE(autres_charges, 0)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT charges_restaurant_mois_unique UNIQUE (restaurant_id, mois)
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charges_select" ON charges FOR SELECT
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "charges_insert" ON charges FOR INSERT
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "charges_update" ON charges FOR UPDATE
  USING (restaurant_id = get_user_restaurant_id());

CREATE INDEX idx_charges_restaurant_mois ON charges(restaurant_id, mois);
