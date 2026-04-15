-- Nouveaux champs mercuriale pour une mercuriale professionnelle complète
ALTER TABLE mercuriale
  ADD COLUMN IF NOT EXISTS unite_commande TEXT,        -- ex: "colis", "carton", "filet"
  ADD COLUMN IF NOT EXISTS colisage DECIMAL(8,2),      -- ex: 5.0 pour "colis de 5kg"
  ADD COLUMN IF NOT EXISTS reference_fournisseur TEXT; -- code article fournisseur
