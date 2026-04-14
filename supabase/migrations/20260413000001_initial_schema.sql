-- Extension pg_net pour triggers async
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ══════════════════════════════════════════════
-- CORE : Multi-tenant
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('restaurant', 'food_truck', 'traiteur', 'brasserie')),
  adresse JSONB,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parametres JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS restaurant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'chef', 'manager')) DEFAULT 'chef',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

-- ══════════════════════════════════════════════
-- CATALOGUE INGRÉDIENTS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingredients_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  categorie TEXT,
  allergenes TEXT[] DEFAULT '{}',
  kcal_par_100g DECIMAL(8,2),
  unite_standard TEXT DEFAULT 'g',
  is_verified BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'manual',
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('french', nom || ' ' || COALESCE(categorie, ''))) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_catalog_search ON ingredients_catalog USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS restaurant_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES ingredients_catalog(id),
  nom_custom TEXT,
  allergenes_override TEXT[],
  kcal_override DECIMAL(8,2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nom_required CHECK (catalog_id IS NOT NULL OR nom_custom IS NOT NULL)
);

CREATE OR REPLACE VIEW ingredients_view AS
SELECT
  ri.id, ri.restaurant_id,
  COALESCE(ri.nom_custom, ic.nom) AS nom,
  COALESCE(ri.allergenes_override, ic.allergenes, '{}') AS allergenes,
  COALESCE(ri.kcal_override, ic.kcal_par_100g) AS kcal_par_100g,
  ic.unite_standard, ri.catalog_id, ri.created_at
FROM restaurant_ingredients ri
LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
WHERE ri.deleted_at IS NULL;

-- ══════════════════════════════════════════════
-- PILIER OPÉRER
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  photo_url TEXT,
  instructions TEXT,
  statut TEXT CHECK (statut IN ('actif', 'archive', 'brouillon')) DEFAULT 'brouillon',
  cout_de_revient DECIMAL(8,2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiche_technique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  grammage DECIMAL(8,2) NOT NULL,
  unite TEXT DEFAULT 'g',
  ordre INTEGER DEFAULT 0,
  fournisseur_id_habituel UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiche_technique_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  ingredients_snapshot JSONB NOT NULL,
  cout_calcule DECIMAL(8,2),
  modifie_par UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiche_mise_en_place (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  etapes JSONB DEFAULT '[]',
  temps_prep_total INTEGER,
  materiel JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- PILIER ACHETER
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  contact_nom TEXT,
  contact_tel TEXT,
  contact_email TEXT,
  contact_whatsapp TEXT,
  delai_jours INTEGER DEFAULT 1,
  min_commande DECIMAL(8,2),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mercuriale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  prix DECIMAL(10,4) NOT NULL,
  unite TEXT NOT NULL,
  est_actif BOOLEAN DEFAULT TRUE,
  source TEXT DEFAULT 'manual',
  date_maj TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mercuriale_ingredient_actif ON mercuriale(ingredient_id, est_actif);

CREATE TABLE IF NOT EXISTS bons_de_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_souhaitee DATE,
  statut TEXT CHECK (statut IN ('brouillon', 'envoye', 'confirme', 'recu')) DEFAULT 'brouillon',
  total_ht DECIMAL(10,2),
  notes TEXT,
  envoye_via TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bon_de_commande_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id UUID REFERENCES bons_de_commande(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  quantite DECIMAL(10,3) NOT NULL,
  unite TEXT NOT NULL,
  prix_unitaire DECIMAL(10,4),
  total_ligne DECIMAL(10,2),
  ordre INTEGER DEFAULT 0
);

-- ══════════════════════════════════════════════
-- PILIER PILOTER
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  plat_id UUID REFERENCES plats(id),
  quantite INTEGER NOT NULL,
  prix_vente DECIMAL(8,2),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  service TEXT CHECK (service IN ('midi', 'soir', 'continu')) DEFAULT 'midi',
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, external_id, source)
);

CREATE TABLE IF NOT EXISTS charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT,
  description TEXT,
  montant DECIMAL(10,2) NOT NULL,
  frequence TEXT CHECK (frequence IN ('mensuel', 'trimestriel', 'annuel', 'unique')),
  date_debut DATE,
  date_fin DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS masse_salariale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  mois DATE NOT NULL,
  montant_brut DECIMAL(10,2) NOT NULL,
  nb_employes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, mois)
);

CREATE TABLE IF NOT EXISTS inventaire_reel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  quantite DECIMAL(10,3) NOT NULL,
  unite TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- EVENT LOG
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_restaurant_type ON events(restaurant_id, type, created_at DESC);
