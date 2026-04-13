CREATE TABLE equipements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('frigo', 'congelateur', 'bain_marie', 'chambre_froide', 'autre')),
  temp_min DECIMAL(5,1) DEFAULT 0,
  temp_max DECIMAL(5,1) DEFAULT 4,
  frequence_releve TEXT CHECK (frequence_releve IN ('1x_jour', '2x_jour', 'chaque_service', 'chaque_cuisson')),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE temperature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id UUID REFERENCES equipements(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  valeur DECIMAL(5,1) NOT NULL,
  action_corrective TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- JAMAIS de UPDATE ni DELETE sur cette table (légal HACCP)
);

CREATE INDEX idx_temp_logs_restaurant_date ON temperature_logs(restaurant_id, created_at DESC);

CREATE TABLE nettoyage_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('pre_service', 'post_service', 'hebdo', 'mensuel')),
  items JSONB DEFAULT '[]',
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nettoyage_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES nettoyage_checklists(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items_valides JSONB DEFAULT '[]',
  signature_url TEXT,
  photo_url TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  duree_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- JAMAIS de UPDATE ni DELETE
);

CREATE TABLE receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  facture_url TEXT,
  statut TEXT CHECK (statut IN ('conforme', 'anomalie', 'refuse')) DEFAULT 'conforme',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reception_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  quantite DECIMAL(10,3),
  unite TEXT,
  numero_lot TEXT,
  dlc DATE,
  temperature_reception DECIMAL(5,1),
  conforme BOOLEAN DEFAULT TRUE,
  anomalie_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE haccp_points_critiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  plat_id UUID REFERENCES plats(id),
  etape TEXT NOT NULL,
  danger TEXT CHECK (danger IN ('biologique', 'chimique', 'physique', 'allergene')),
  temperature_critique DECIMAL(5,1),
  action_corrective TEXT,
  frequence_controle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rappel_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  rappelconso_id TEXT NOT NULL,
  produit_nom TEXT,
  fournisseur TEXT,
  date_alerte TIMESTAMPTZ DEFAULT NOW(),
  lot_concerne TEXT,
  statut TEXT CHECK (statut IN ('nouveau', 'lu', 'traite')) DEFAULT 'nouveau',
  action_prise TEXT,
  UNIQUE(restaurant_id, rappelconso_id)
);

CREATE TABLE formations_hygiene (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type_formation TEXT,
  date_obtention DATE,
  date_expiration DATE,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT CHECK (plan IN ('starter', 'pro', 'multi')) DEFAULT 'pro',
  statut TEXT DEFAULT 'trialing',
  trial_end TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
