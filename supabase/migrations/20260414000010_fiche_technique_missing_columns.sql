-- Migration 000010 : colonnes manquantes sur fiche_technique
-- nom_ingredient utilisé dans le code mais absent du schéma initial
-- restaurant_id nécessaire pour le RLS multi-tenant

ALTER TABLE fiche_technique
  ADD COLUMN IF NOT EXISTS nom_ingredient TEXT,
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- Backfill restaurant_id depuis la table plats pour les lignes existantes
UPDATE fiche_technique ft
SET restaurant_id = p.restaurant_id
FROM plats p
WHERE ft.plat_id = p.id
  AND ft.restaurant_id IS NULL;

-- Index pour les requêtes RLS
CREATE INDEX IF NOT EXISTS idx_fiche_technique_restaurant ON fiche_technique(restaurant_id);
