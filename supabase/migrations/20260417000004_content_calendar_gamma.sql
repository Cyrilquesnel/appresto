-- Ajoute gamma_url à content_calendar pour les carousels générés par Gamma
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS gamma_url TEXT;
