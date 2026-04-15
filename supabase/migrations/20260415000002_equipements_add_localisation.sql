-- Ajout de la colonne localisation manquante dans equipements

ALTER TABLE equipements
  ADD COLUMN IF NOT EXISTS localisation TEXT;
