-- Ajout de la colonne bon_de_commande_id manquante dans receptions
-- Référence vers bons_de_commande pour lier une réception à un bon de commande

ALTER TABLE receptions
  ADD COLUMN IF NOT EXISTS bon_de_commande_id UUID REFERENCES bons_de_commande(id) ON DELETE SET NULL;
