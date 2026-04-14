-- Migration 000008 : colonnes manquantes sur la table ventes
-- mode_saisie, nb_couverts, panier_moyen, montant_total, notes

ALTER TABLE ventes
  ADD COLUMN IF NOT EXISTS mode_saisie TEXT CHECK (mode_saisie IN ('simple', 'detail')) DEFAULT 'detail',
  ADD COLUMN IF NOT EXISTS nb_couverts INTEGER,
  ADD COLUMN IF NOT EXISTS panier_moyen DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS montant_total DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS notes TEXT;
