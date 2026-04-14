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
CREATE TABLE IF NOT EXISTS equipements (
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

CREATE TABLE IF NOT EXISTS temperature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id UUID REFERENCES equipements(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  valeur DECIMAL(5,1) NOT NULL,
  action_corrective TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- JAMAIS de UPDATE ni DELETE sur cette table (légal HACCP)
);

CREATE INDEX IF NOT EXISTS idx_temp_logs_restaurant_date ON temperature_logs(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nettoyage_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('pre_service', 'post_service', 'hebdo', 'mensuel')),
  items JSONB DEFAULT '[]',
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nettoyage_completions (
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

CREATE TABLE IF NOT EXISTS receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  facture_url TEXT,
  statut TEXT CHECK (statut IN ('conforme', 'anomalie', 'refuse')) DEFAULT 'conforme',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reception_items (
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

CREATE TABLE IF NOT EXISTS haccp_points_critiques (
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

CREATE TABLE IF NOT EXISTS rappel_alerts (
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

CREATE TABLE IF NOT EXISTS formations_hygiene (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type_formation TEXT,
  date_obtention DATE,
  date_expiration DATE,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
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
-- Fonction helper multi-tenant
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Activer RLS sur toutes les tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE plats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_technique ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_technique_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_mise_en_place ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercuriale ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_de_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_de_commande_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE masse_salariale ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_reel ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nettoyage_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE nettoyage_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_points_critiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE rappel_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations_hygiene ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RESTAURANTS (owner uniquement)
DROP POLICY IF EXISTS "restaurants_select" ON restaurants;
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT USING (owner_id = auth.uid() OR id = get_user_restaurant_id());
DROP POLICY IF EXISTS "restaurants_insert" ON restaurants;
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "restaurants_update" ON restaurants;
CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE USING (owner_id = auth.uid());

-- RESTAURANT_USERS
DROP POLICY IF EXISTS "restaurant_users_select" ON restaurant_users;
CREATE POLICY "restaurant_users_select" ON restaurant_users FOR SELECT USING (user_id = auth.uid() OR restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "restaurant_users_insert" ON restaurant_users;
CREATE POLICY "restaurant_users_insert" ON restaurant_users FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id() OR user_id = auth.uid());

-- INGREDIENTS CATALOG (lecture publique authentifiée)
DROP POLICY IF EXISTS "catalog_select" ON ingredients_catalog;
CREATE POLICY "catalog_select" ON ingredients_catalog FOR SELECT TO authenticated USING (true);

-- RESTAURANT_INGREDIENTS
DROP POLICY IF EXISTS "ri_select" ON restaurant_ingredients;
CREATE POLICY "ri_select" ON restaurant_ingredients FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ri_insert" ON restaurant_ingredients;
CREATE POLICY "ri_insert" ON restaurant_ingredients FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ri_update" ON restaurant_ingredients;
CREATE POLICY "ri_update" ON restaurant_ingredients FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ri_delete" ON restaurant_ingredients;
CREATE POLICY "ri_delete" ON restaurant_ingredients FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- PLATS
DROP POLICY IF EXISTS "plats_select" ON plats;
CREATE POLICY "plats_select" ON plats FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "plats_insert" ON plats;
CREATE POLICY "plats_insert" ON plats FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "plats_update" ON plats;
CREATE POLICY "plats_update" ON plats FOR UPDATE USING (restaurant_id = get_user_restaurant_id()) WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "plats_delete" ON plats;
CREATE POLICY "plats_delete" ON plats FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- FICHE_TECHNIQUE (via plat)
DROP POLICY IF EXISTS "fiche_technique_select" ON fiche_technique;
CREATE POLICY "fiche_technique_select" ON fiche_technique FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_technique_insert" ON fiche_technique;
CREATE POLICY "fiche_technique_insert" ON fiche_technique FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_technique_update" ON fiche_technique;
CREATE POLICY "fiche_technique_update" ON fiche_technique FOR UPDATE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_technique_delete" ON fiche_technique;
CREATE POLICY "fiche_technique_delete" ON fiche_technique FOR DELETE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FICHE_TECHNIQUE_VERSIONS (SELECT + INSERT seulement)
DROP POLICY IF EXISTS "fiche_versions_select" ON fiche_technique_versions;
CREATE POLICY "fiche_versions_select" ON fiche_technique_versions FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_versions_insert" ON fiche_technique_versions;
CREATE POLICY "fiche_versions_insert" ON fiche_technique_versions FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FICHE_MISE_EN_PLACE
DROP POLICY IF EXISTS "fiche_mep_select" ON fiche_mise_en_place;
CREATE POLICY "fiche_mep_select" ON fiche_mise_en_place FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_mep_insert" ON fiche_mise_en_place;
CREATE POLICY "fiche_mep_insert" ON fiche_mise_en_place FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "fiche_mep_update" ON fiche_mise_en_place;
CREATE POLICY "fiche_mep_update" ON fiche_mise_en_place FOR UPDATE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FOURNISSEURS
DROP POLICY IF EXISTS "fournisseurs_select" ON fournisseurs;
CREATE POLICY "fournisseurs_select" ON fournisseurs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "fournisseurs_insert" ON fournisseurs;
CREATE POLICY "fournisseurs_insert" ON fournisseurs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "fournisseurs_update" ON fournisseurs;
CREATE POLICY "fournisseurs_update" ON fournisseurs FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "fournisseurs_delete" ON fournisseurs;
CREATE POLICY "fournisseurs_delete" ON fournisseurs FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- MERCURIALE
DROP POLICY IF EXISTS "mercuriale_select" ON mercuriale;
CREATE POLICY "mercuriale_select" ON mercuriale FOR SELECT USING (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "mercuriale_insert" ON mercuriale;
CREATE POLICY "mercuriale_insert" ON mercuriale FOR INSERT WITH CHECK (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "mercuriale_update" ON mercuriale;
CREATE POLICY "mercuriale_update" ON mercuriale FOR UPDATE USING (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));

-- BONS DE COMMANDE
DROP POLICY IF EXISTS "bons_select" ON bons_de_commande;
CREATE POLICY "bons_select" ON bons_de_commande FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "bons_insert" ON bons_de_commande;
CREATE POLICY "bons_insert" ON bons_de_commande FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "bons_update" ON bons_de_commande;
CREATE POLICY "bons_update" ON bons_de_commande FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "bons_delete" ON bons_de_commande;
CREATE POLICY "bons_delete" ON bons_de_commande FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- BON LIGNES (via bon)
DROP POLICY IF EXISTS "bon_lignes_select" ON bon_de_commande_lignes;
CREATE POLICY "bon_lignes_select" ON bon_de_commande_lignes FOR SELECT USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "bon_lignes_insert" ON bon_de_commande_lignes;
CREATE POLICY "bon_lignes_insert" ON bon_de_commande_lignes FOR INSERT WITH CHECK (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "bon_lignes_update" ON bon_de_commande_lignes;
CREATE POLICY "bon_lignes_update" ON bon_de_commande_lignes FOR UPDATE USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "bon_lignes_delete" ON bon_de_commande_lignes;
CREATE POLICY "bon_lignes_delete" ON bon_de_commande_lignes FOR DELETE USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));

-- VENTES
DROP POLICY IF EXISTS "ventes_select" ON ventes;
CREATE POLICY "ventes_select" ON ventes FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ventes_insert" ON ventes;
CREATE POLICY "ventes_insert" ON ventes FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ventes_update" ON ventes;
CREATE POLICY "ventes_update" ON ventes FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "ventes_delete" ON ventes;
CREATE POLICY "ventes_delete" ON ventes FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- CHARGES
DROP POLICY IF EXISTS "charges_select" ON charges;
CREATE POLICY "charges_select" ON charges FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "charges_insert" ON charges;
CREATE POLICY "charges_insert" ON charges FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "charges_update" ON charges;
CREATE POLICY "charges_update" ON charges FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "charges_delete" ON charges;
CREATE POLICY "charges_delete" ON charges FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- MASSE SALARIALE
DROP POLICY IF EXISTS "masse_select" ON masse_salariale;
CREATE POLICY "masse_select" ON masse_salariale FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "masse_insert" ON masse_salariale;
CREATE POLICY "masse_insert" ON masse_salariale FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "masse_update" ON masse_salariale;
CREATE POLICY "masse_update" ON masse_salariale FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- INVENTAIRE REEL
DROP POLICY IF EXISTS "inventaire_select" ON inventaire_reel;
CREATE POLICY "inventaire_select" ON inventaire_reel FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "inventaire_insert" ON inventaire_reel;
CREATE POLICY "inventaire_insert" ON inventaire_reel FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

-- PUSH SUBSCRIPTIONS
DROP POLICY IF EXISTS "push_sub_select" ON push_subscriptions;
CREATE POLICY "push_sub_select" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "push_sub_insert" ON push_subscriptions;
CREATE POLICY "push_sub_insert" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "push_sub_update" ON push_subscriptions;
CREATE POLICY "push_sub_update" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "push_sub_delete" ON push_subscriptions;
CREATE POLICY "push_sub_delete" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

-- EVENTS
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

-- EQUIPEMENTS
DROP POLICY IF EXISTS "equipements_select" ON equipements;
CREATE POLICY "equipements_select" ON equipements FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "equipements_insert" ON equipements;
CREATE POLICY "equipements_insert" ON equipements FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "equipements_update" ON equipements;
CREATE POLICY "equipements_update" ON equipements FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "equipements_delete" ON equipements;
CREATE POLICY "equipements_delete" ON equipements FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- TEMPERATURE LOGS : INSERT SEULEMENT (immuabilité légale HACCP)
DROP POLICY IF EXISTS "temp_logs_select" ON temperature_logs;
CREATE POLICY "temp_logs_select" ON temperature_logs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "temp_logs_insert" ON temperature_logs;
CREATE POLICY "temp_logs_insert" ON temperature_logs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- NETTOYAGE CHECKLISTS
DROP POLICY IF EXISTS "nettoyage_checklists_select" ON nettoyage_checklists;
CREATE POLICY "nettoyage_checklists_select" ON nettoyage_checklists FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "nettoyage_checklists_insert" ON nettoyage_checklists;
CREATE POLICY "nettoyage_checklists_insert" ON nettoyage_checklists FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "nettoyage_checklists_update" ON nettoyage_checklists;
CREATE POLICY "nettoyage_checklists_update" ON nettoyage_checklists FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- NETTOYAGE COMPLETIONS : INSERT SEULEMENT (immuabilité légale)
DROP POLICY IF EXISTS "nettoyage_completions_select" ON nettoyage_completions;
CREATE POLICY "nettoyage_completions_select" ON nettoyage_completions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "nettoyage_completions_insert" ON nettoyage_completions;
CREATE POLICY "nettoyage_completions_insert" ON nettoyage_completions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- RECEPTIONS
DROP POLICY IF EXISTS "receptions_select" ON receptions;
CREATE POLICY "receptions_select" ON receptions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "receptions_insert" ON receptions;
CREATE POLICY "receptions_insert" ON receptions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "receptions_update" ON receptions;
CREATE POLICY "receptions_update" ON receptions FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- RECEPTION ITEMS (via reception)
DROP POLICY IF EXISTS "reception_items_select" ON reception_items;
CREATE POLICY "reception_items_select" ON reception_items FOR SELECT USING (reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id()));
DROP POLICY IF EXISTS "reception_items_insert" ON reception_items;
CREATE POLICY "reception_items_insert" ON reception_items FOR INSERT WITH CHECK (reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id()));

-- HACCP
DROP POLICY IF EXISTS "haccp_select" ON haccp_points_critiques;
CREATE POLICY "haccp_select" ON haccp_points_critiques FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "haccp_insert" ON haccp_points_critiques;
CREATE POLICY "haccp_insert" ON haccp_points_critiques FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "haccp_update" ON haccp_points_critiques;
CREATE POLICY "haccp_update" ON haccp_points_critiques FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "haccp_delete" ON haccp_points_critiques;
CREATE POLICY "haccp_delete" ON haccp_points_critiques FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- RAPPEL ALERTS
DROP POLICY IF EXISTS "rappel_select" ON rappel_alerts;
CREATE POLICY "rappel_select" ON rappel_alerts FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "rappel_insert" ON rappel_alerts;
CREATE POLICY "rappel_insert" ON rappel_alerts FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "rappel_update" ON rappel_alerts;
CREATE POLICY "rappel_update" ON rappel_alerts FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- FORMATIONS HYGIENE
DROP POLICY IF EXISTS "formations_select" ON formations_hygiene;
CREATE POLICY "formations_select" ON formations_hygiene FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "formations_insert" ON formations_hygiene;
CREATE POLICY "formations_insert" ON formations_hygiene FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "formations_update" ON formations_hygiene;
CREATE POLICY "formations_update" ON formations_hygiene FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "sub_select" ON subscriptions;
CREATE POLICY "sub_select" ON subscriptions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "sub_insert" ON subscriptions;
CREATE POLICY "sub_insert" ON subscriptions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "sub_update" ON subscriptions;
CREATE POLICY "sub_update" ON subscriptions FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
-- Activer pg_net pour les appels HTTP asynchrones depuis les triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger cascade prix → coûts (async via pg_net, non-bloquant)
-- app.edge_function_url et app.service_role_key doivent être configurés :
--   En dev local : ALTER DATABASE postgres SET app.edge_function_url = 'http://localhost:54321/functions/v1';
--                  ALTER DATABASE postgres SET app.service_role_key = '<local-anon-key>';
--   En production : utiliser Supabase Vault (vault.secrets)
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url', true) || '/recalculate-costs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    -- body doit être TEXT pour pg_net
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix
    )::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la transaction mercuriale même si pg_net échoue
  RAISE WARNING '[trigger_recalculate_costs] Erreur pg_net: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_mercuriale_update ON mercuriale;
CREATE TRIGGER after_mercuriale_update
  AFTER INSERT OR UPDATE OF prix ON mercuriale
  FOR EACH ROW
  WHEN (NEW.est_actif = TRUE)
  EXECUTE FUNCTION trigger_recalculate_costs();

-- Fonction recherche ingrédients
CREATE OR REPLACE FUNCTION search_ingredients(
  p_query TEXT,
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (id UUID, nom TEXT, source TEXT, allergenes TEXT[], score REAL) AS $$
  SELECT ri.id, COALESCE(ri.nom_custom, ic.nom) AS nom, 'restaurant' AS source,
    COALESCE(ri.allergenes_override, ic.allergenes, '{}') AS allergenes, 1.0::REAL AS score
  FROM restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE ri.restaurant_id = p_restaurant_id AND ri.deleted_at IS NULL
    AND (ri.nom_custom ILIKE '%' || p_query || '%' OR ic.nom ILIKE '%' || p_query || '%')
  UNION ALL
  SELECT ic.id, ic.nom, 'catalog' AS source, ic.allergenes,
    ts_rank(ic.search_vector, plainto_tsquery('french', p_query)) AS score
  FROM ingredients_catalog ic
  WHERE ic.search_vector @@ plainto_tsquery('french', p_query)
    AND (p_restaurant_id IS NULL OR ic.id NOT IN (
      SELECT catalog_id FROM restaurant_ingredients
      WHERE restaurant_id = p_restaurant_id AND catalog_id IS NOT NULL
    ))
  ORDER BY source DESC, score DESC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
-- Push subscriptions for Web Push VAPID notifications
-- Note: table also created in migration 1, this migration adds user_agent column
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Un seul abonnement actif par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
-- Seed: 508 ingrédients catalogue
-- Généré automatiquement — Task 6.4

INSERT INTO ingredients_catalog (nom, categorie, allergenes, kcal_par_100g, unite_standard, is_verified, source)
VALUES
  ('Poulet (blanc)', 'viande', ARRAY[]::TEXT[], 165, 'g', TRUE, 'seed'),
  ('Poulet (cuisse)', 'viande', ARRAY[]::TEXT[], 209, 'g', TRUE, 'seed'),
  ('Poulet (aile)', 'viande', ARRAY[]::TEXT[], 215, 'g', TRUE, 'seed'),
  ('Bœuf haché 5% MG', 'viande', ARRAY[]::TEXT[], 137, 'g', TRUE, 'seed'),
  ('Bœuf haché 15% MG', 'viande', ARRAY[]::TEXT[], 215, 'g', TRUE, 'seed'),
  ('Bœuf (entrecôte)', 'viande', ARRAY[]::TEXT[], 271, 'g', TRUE, 'seed'),
  ('Bœuf (faux-filet)', 'viande', ARRAY[]::TEXT[], 250, 'g', TRUE, 'seed'),
  ('Bœuf (rumsteck)', 'viande', ARRAY[]::TEXT[], 235, 'g', TRUE, 'seed'),
  ('Bœuf (paleron)', 'viande', ARRAY[]::TEXT[], 180, 'g', TRUE, 'seed'),
  ('Veau (escalope)', 'viande', ARRAY[]::TEXT[], 131, 'g', TRUE, 'seed'),
  ('Veau (côtelette)', 'viande', ARRAY[]::TEXT[], 185, 'g', TRUE, 'seed'),
  ('Veau (quasi)', 'viande', ARRAY[]::TEXT[], 145, 'g', TRUE, 'seed'),
  ('Porc (filet)', 'viande', ARRAY[]::TEXT[], 143, 'g', TRUE, 'seed'),
  ('Porc (côtelette)', 'viande', ARRAY[]::TEXT[], 230, 'g', TRUE, 'seed'),
  ('Porc (lardons)', 'viande', ARRAY[]::TEXT[], 337, 'g', TRUE, 'seed'),
  ('Porc (jambon blanc)', 'viande', ARRAY[]::TEXT[], 115, 'g', TRUE, 'seed'),
  ('Canard (magret)', 'viande', ARRAY[]::TEXT[], 201, 'g', TRUE, 'seed'),
  ('Canard (cuisses confites)', 'viande', ARRAY[]::TEXT[], 389, 'g', TRUE, 'seed'),
  ('Agneau (gigot)', 'viande', ARRAY[]::TEXT[], 282, 'g', TRUE, 'seed'),
  ('Agneau (côtelettes)', 'viande', ARRAY[]::TEXT[], 290, 'g', TRUE, 'seed'),
  ('Lapin (râble)', 'viande', ARRAY[]::TEXT[], 136, 'g', TRUE, 'seed'),
  ('Dinde (blanc)', 'viande', ARRAY[]::TEXT[], 104, 'g', TRUE, 'seed'),
  ('Andouillette', 'viande', ARRAY[]::TEXT[], 300, 'g', TRUE, 'seed'),
  ('Foie de veau', 'viande', ARRAY[]::TEXT[], 136, 'g', TRUE, 'seed'),
  ('Foie gras (canard)', 'viande', ARRAY[]::TEXT[], 462, 'g', TRUE, 'seed'),
  ('Chorizo', 'viande', ARRAY[]::TEXT[], 380, 'g', TRUE, 'seed'),
  ('Saucisse de Toulouse', 'viande', ARRAY[]::TEXT[], 290, 'g', TRUE, 'seed'),
  ('Merguez', 'viande', ARRAY[]::TEXT[], 310, 'g', TRUE, 'seed'),
  ('Boudin noir', 'viande', ARRAY[]::TEXT[], 306, 'g', TRUE, 'seed'),
  ('Rognons de veau', 'viande', ARRAY[]::TEXT[], 99, 'g', TRUE, 'seed'),
  ('Saumon (filet)', 'poisson', ARRAY['poisson'], 208, 'g', TRUE, 'seed'),
  ('Saumon fumé', 'poisson', ARRAY['poisson'], 172, 'g', TRUE, 'seed'),
  ('Cabillaud (filet)', 'poisson', ARRAY['poisson'], 82, 'g', TRUE, 'seed'),
  ('Thon rouge (filet)', 'poisson', ARRAY['poisson'], 144, 'g', TRUE, 'seed'),
  ('Thon albacore', 'poisson', ARRAY['poisson'], 130, 'g', TRUE, 'seed'),
  ('Sole (filet)', 'poisson', ARRAY['poisson'], 83, 'g', TRUE, 'seed'),
  ('Bar (loup de mer)', 'poisson', ARRAY['poisson'], 97, 'g', TRUE, 'seed'),
  ('Daurade royale', 'poisson', ARRAY['poisson'], 96, 'g', TRUE, 'seed'),
  ('Merlan (filet)', 'poisson', ARRAY['poisson'], 82, 'g', TRUE, 'seed'),
  ('Turbot (filet)', 'poisson', ARRAY['poisson'], 95, 'g', TRUE, 'seed'),
  ('Rouget (filet)', 'poisson', ARRAY['poisson'], 109, 'g', TRUE, 'seed'),
  ('Maquereau (filet)', 'poisson', ARRAY['poisson'], 205, 'g', TRUE, 'seed'),
  ('Sardines fraîches', 'poisson', ARRAY['poisson'], 135, 'g', TRUE, 'seed'),
  ('Hareng fumé', 'poisson', ARRAY['poisson'], 217, 'g', TRUE, 'seed'),
  ('Crevettes roses', 'poisson', ARRAY['crustaces'], 85, 'g', TRUE, 'seed'),
  ('Gambas', 'poisson', ARRAY['crustaces'], 90, 'g', TRUE, 'seed'),
  ('Homard', 'poisson', ARRAY['crustaces'], 90, 'g', TRUE, 'seed'),
  ('Langoustines', 'poisson', ARRAY['crustaces'], 77, 'g', TRUE, 'seed'),
  ('Crabe (chair)', 'poisson', ARRAY['crustaces'], 97, 'g', TRUE, 'seed'),
  ('Moules', 'poisson', ARRAY['mollusques'], 86, 'g', TRUE, 'seed'),
  ('Saint-Jacques', 'poisson', ARRAY['mollusques'], 88, 'g', TRUE, 'seed'),
  ('Huîtres', 'poisson', ARRAY['mollusques'], 68, 'g', TRUE, 'seed'),
  ('Calmars', 'poisson', ARRAY['mollusques'], 92, 'g', TRUE, 'seed'),
  ('Poulpe', 'poisson', ARRAY['mollusques'], 82, 'g', TRUE, 'seed'),
  ('Tomates', 'legume', ARRAY[]::TEXT[], 18, 'g', TRUE, 'seed'),
  ('Tomates cerises', 'legume', ARRAY[]::TEXT[], 20, 'g', TRUE, 'seed'),
  ('Tomates olivettes', 'legume', ARRAY[]::TEXT[], 18, 'g', TRUE, 'seed'),
  ('Oignons', 'legume', ARRAY[]::TEXT[], 40, 'g', TRUE, 'seed'),
  ('Oignons rouges', 'legume', ARRAY[]::TEXT[], 42, 'g', TRUE, 'seed'),
  ('Échalotes', 'legume', ARRAY[]::TEXT[], 72, 'g', TRUE, 'seed'),
  ('Ail', 'legume', ARRAY[]::TEXT[], 149, 'g', TRUE, 'seed'),
  ('Carottes', 'legume', ARRAY[]::TEXT[], 41, 'g', TRUE, 'seed'),
  ('Pommes de terre (Bintje)', 'legume', ARRAY[]::TEXT[], 77, 'g', TRUE, 'seed'),
  ('Pommes de terre (Charlotte)', 'legume', ARRAY[]::TEXT[], 77, 'g', TRUE, 'seed'),
  ('Pommes de terre (Ratte)', 'legume', ARRAY[]::TEXT[], 80, 'g', TRUE, 'seed'),
  ('Champignons de Paris', 'legume', ARRAY[]::TEXT[], 22, 'g', TRUE, 'seed'),
  ('Champignons shiitake', 'legume', ARRAY[]::TEXT[], 34, 'g', TRUE, 'seed'),
  ('Cèpes séchés', 'legume', ARRAY[]::TEXT[], 320, 'g', TRUE, 'seed'),
  ('Girolles', 'legume', ARRAY[]::TEXT[], 32, 'g', TRUE, 'seed'),
  ('Morilles séchées', 'legume', ARRAY[]::TEXT[], 315, 'g', TRUE, 'seed'),
  ('Épinards', 'legume', ARRAY[]::TEXT[], 23, 'g', TRUE, 'seed'),
  ('Courgettes', 'legume', ARRAY[]::TEXT[], 17, 'g', TRUE, 'seed'),
  ('Aubergines', 'legume', ARRAY[]::TEXT[], 25, 'g', TRUE, 'seed'),
  ('Poivrons rouges', 'legume', ARRAY[]::TEXT[], 31, 'g', TRUE, 'seed'),
  ('Poivrons verts', 'legume', ARRAY[]::TEXT[], 20, 'g', TRUE, 'seed'),
  ('Poivrons jaunes', 'legume', ARRAY[]::TEXT[], 27, 'g', TRUE, 'seed'),
  ('Brocoli', 'legume', ARRAY[]::TEXT[], 34, 'g', TRUE, 'seed'),
  ('Chou-fleur', 'legume', ARRAY[]::TEXT[], 25, 'g', TRUE, 'seed'),
  ('Chou blanc', 'legume', ARRAY[]::TEXT[], 25, 'g', TRUE, 'seed'),
  ('Chou rouge', 'legume', ARRAY[]::TEXT[], 31, 'g', TRUE, 'seed'),
  ('Choux de Bruxelles', 'legume', ARRAY[]::TEXT[], 43, 'g', TRUE, 'seed'),
  ('Poireaux', 'legume', ARRAY[]::TEXT[], 31, 'g', TRUE, 'seed'),
  ('Céleri-rave', 'legume', ARRAY['celeri'], 42, 'g', TRUE, 'seed'),
  ('Céleri branche', 'legume', ARRAY['celeri'], 16, 'g', TRUE, 'seed'),
  ('Fenouil', 'legume', ARRAY[]::TEXT[], 31, 'g', TRUE, 'seed'),
  ('Artichaut', 'legume', ARRAY[]::TEXT[], 53, 'g', TRUE, 'seed'),
  ('Asperges vertes', 'legume', ARRAY[]::TEXT[], 20, 'g', TRUE, 'seed'),
  ('Asperges blanches', 'legume', ARRAY[]::TEXT[], 22, 'g', TRUE, 'seed'),
  ('Haricots verts', 'legume', ARRAY[]::TEXT[], 31, 'g', TRUE, 'seed'),
  ('Petits pois', 'legume', ARRAY[]::TEXT[], 81, 'g', TRUE, 'seed'),
  ('Pois chiches cuits', 'legume', ARRAY[]::TEXT[], 164, 'g', TRUE, 'seed'),
  ('Lentilles cuites', 'legume', ARRAY[]::TEXT[], 116, 'g', TRUE, 'seed'),
  ('Betterave rouge', 'legume', ARRAY[]::TEXT[], 43, 'g', TRUE, 'seed'),
  ('Radis', 'legume', ARRAY[]::TEXT[], 16, 'g', TRUE, 'seed'),
  ('Concombre', 'legume', ARRAY[]::TEXT[], 15, 'g', TRUE, 'seed'),
  ('Endives', 'legume', ARRAY[]::TEXT[], 17, 'g', TRUE, 'seed'),
  ('Salade romaine', 'legume', ARRAY[]::TEXT[], 17, 'g', TRUE, 'seed'),
  ('Mesclun', 'legume', ARRAY[]::TEXT[], 14, 'g', TRUE, 'seed'),
  ('Roquette', 'legume', ARRAY[]::TEXT[], 25, 'g', TRUE, 'seed'),
  ('Mâche', 'legume', ARRAY[]::TEXT[], 14, 'g', TRUE, 'seed'),
  ('Navet', 'legume', ARRAY[]::TEXT[], 28, 'g', TRUE, 'seed'),
  ('Panais', 'legume', ARRAY[]::TEXT[], 75, 'g', TRUE, 'seed'),
  ('Patate douce', 'legume', ARRAY[]::TEXT[], 86, 'g', TRUE, 'seed'),
  ('Maïs (grains)', 'legume', ARRAY[]::TEXT[], 86, 'g', TRUE, 'seed'),
  ('Farine de blé T45', 'feculent', ARRAY['gluten'], 364, 'g', TRUE, 'seed'),
  ('Farine de blé T55', 'feculent', ARRAY['gluten'], 364, 'g', TRUE, 'seed'),
  ('Farine de blé T65', 'feculent', ARRAY['gluten'], 354, 'g', TRUE, 'seed'),
  ('Farine de seigle', 'feculent', ARRAY['gluten'], 335, 'g', TRUE, 'seed'),
  ('Farine de sarrasin', 'feculent', ARRAY[]::TEXT[], 335, 'g', TRUE, 'seed'),
  ('Farine de riz', 'feculent', ARRAY[]::TEXT[], 366, 'g', TRUE, 'seed'),
  ('Fécule de maïs (Maïzena)', 'feculent', ARRAY[]::TEXT[], 381, 'g', TRUE, 'seed'),
  ('Fécule de pomme de terre', 'feculent', ARRAY[]::TEXT[], 357, 'g', TRUE, 'seed'),
  ('Riz basmati', 'feculent', ARRAY[]::TEXT[], 351, 'g', TRUE, 'seed'),
  ('Riz arborio (risotto)', 'feculent', ARRAY[]::TEXT[], 350, 'g', TRUE, 'seed'),
  ('Riz thaï', 'feculent', ARRAY[]::TEXT[], 350, 'g', TRUE, 'seed'),
  ('Riz long grain', 'feculent', ARRAY[]::TEXT[], 350, 'g', TRUE, 'seed'),
  ('Pâtes sèches (spaghetti)', 'feculent', ARRAY['gluten'], 352, 'g', TRUE, 'seed'),
  ('Pâtes sèches (tagliatelles)', 'feculent', ARRAY['gluten','oeufs'], 352, 'g', TRUE, 'seed'),
  ('Pâtes sèches (penne)', 'feculent', ARRAY['gluten'], 352, 'g', TRUE, 'seed'),
  ('Pâtes fraîches (tagliatelles)', 'feculent', ARRAY['gluten','oeufs'], 275, 'g', TRUE, 'seed'),
  ('Gnocchis frais', 'feculent', ARRAY['gluten','oeufs'], 150, 'g', TRUE, 'seed'),
  ('Lentilles vertes', 'feculent', ARRAY[]::TEXT[], 353, 'g', TRUE, 'seed'),
  ('Lentilles corail', 'feculent', ARRAY[]::TEXT[], 353, 'g', TRUE, 'seed'),
  ('Quinoa', 'feculent', ARRAY[]::TEXT[], 368, 'g', TRUE, 'seed'),
  ('Boulgour', 'feculent', ARRAY['gluten'], 342, 'g', TRUE, 'seed'),
  ('Semoule fine', 'feculent', ARRAY['gluten'], 360, 'g', TRUE, 'seed'),
  ('Polenta (semoule de maïs)', 'feculent', ARRAY[]::TEXT[], 362, 'g', TRUE, 'seed'),
  ('Pain de mie', 'feculent', ARRAY['gluten'], 266, 'g', TRUE, 'seed'),
  ('Pain brioche', 'feculent', ARRAY['gluten','oeufs','lait'], 350, 'g', TRUE, 'seed'),
  ('Chapelure', 'feculent', ARRAY['gluten'], 395, 'g', TRUE, 'seed'),
  ('Biscuits secs (pour desserts)', 'feculent', ARRAY['gluten','lait','oeufs'], 450, 'g', TRUE, 'seed'),
  ('Filo (pâte)', 'feculent', ARRAY['gluten'], 297, 'g', TRUE, 'seed'),
  ('Pâte brisée', 'feculent', ARRAY['gluten','lait'], 400, 'g', TRUE, 'seed'),
  ('Pâte feuilletée', 'feculent', ARRAY['gluten','lait'], 490, 'g', TRUE, 'seed'),
  ('Beurre doux', 'laitage', ARRAY['lait'], 717, 'g', TRUE, 'seed'),
  ('Beurre demi-sel', 'laitage', ARRAY['lait'], 717, 'g', TRUE, 'seed'),
  ('Beurre clarifié (ghee)', 'laitage', ARRAY['lait'], 900, 'g', TRUE, 'seed'),
  ('Crème fraîche épaisse 30%', 'laitage', ARRAY['lait'], 292, 'g', TRUE, 'seed'),
  ('Crème fraîche épaisse 40%', 'laitage', ARRAY['lait'], 380, 'g', TRUE, 'seed'),
  ('Crème liquide 35%', 'laitage', ARRAY['lait'], 345, 'ml', TRUE, 'seed'),
  ('Crème légère 15%', 'laitage', ARRAY['lait'], 150, 'ml', TRUE, 'seed'),
  ('Crème de coco', 'laitage', ARRAY[]::TEXT[], 330, 'ml', TRUE, 'seed'),
  ('Lait entier', 'laitage', ARRAY['lait'], 61, 'ml', TRUE, 'seed'),
  ('Lait demi-écrémé', 'laitage', ARRAY['lait'], 45, 'ml', TRUE, 'seed'),
  ('Lait écrémé', 'laitage', ARRAY['lait'], 33, 'ml', TRUE, 'seed'),
  ('Lait de coco', 'laitage', ARRAY[]::TEXT[], 197, 'ml', TRUE, 'seed'),
  ('Yaourt nature', 'laitage', ARRAY['lait'], 59, 'g', TRUE, 'seed'),
  ('Yaourt grec', 'laitage', ARRAY['lait'], 115, 'g', TRUE, 'seed'),
  ('Crème fraîche (crème acidulée)', 'laitage', ARRAY['lait'], 210, 'g', TRUE, 'seed'),
  ('Lait ribot (babeurre)', 'laitage', ARRAY['lait'], 40, 'ml', TRUE, 'seed'),
  ('Mozzarella', 'laitage', ARRAY['lait'], 280, 'g', TRUE, 'seed'),
  ('Mozzarella di bufala', 'laitage', ARRAY['lait'], 290, 'g', TRUE, 'seed'),
  ('Burrata', 'laitage', ARRAY['lait'], 330, 'g', TRUE, 'seed'),
  ('Ricotta', 'fromage', ARRAY['lait'], 174, 'g', TRUE, 'seed'),
  ('Parmesan (reggiano)', 'fromage', ARRAY['lait'], 431, 'g', TRUE, 'seed'),
  ('Gruyère', 'fromage', ARRAY['lait'], 413, 'g', TRUE, 'seed'),
  ('Comté 12 mois', 'fromage', ARRAY['lait'], 409, 'g', TRUE, 'seed'),
  ('Comté 24 mois', 'fromage', ARRAY['lait'], 420, 'g', TRUE, 'seed'),
  ('Emmental', 'fromage', ARRAY['lait'], 380, 'g', TRUE, 'seed'),
  ('Beaufort', 'fromage', ARRAY['lait'], 401, 'g', TRUE, 'seed'),
  ('Roquefort', 'fromage', ARRAY['lait'], 369, 'g', TRUE, 'seed'),
  ('Gorgonzola', 'fromage', ARRAY['lait'], 361, 'g', TRUE, 'seed'),
  ('Bleu d''Auvergne', 'fromage', ARRAY['lait'], 350, 'g', TRUE, 'seed'),
  ('Brie de Meaux', 'fromage', ARRAY['lait'], 334, 'g', TRUE, 'seed'),
  ('Camembert', 'fromage', ARRAY['lait'], 300, 'g', TRUE, 'seed'),
  ('Chèvre frais', 'fromage', ARRAY['lait'], 268, 'g', TRUE, 'seed'),
  ('Chèvre sec', 'fromage', ARRAY['lait'], 375, 'g', TRUE, 'seed'),
  ('Cheddar', 'fromage', ARRAY['lait'], 400, 'g', TRUE, 'seed'),
  ('Mascarpone', 'fromage', ARRAY['lait'], 429, 'g', TRUE, 'seed'),
  ('Philadelphia (fromage frais)', 'fromage', ARRAY['lait'], 350, 'g', TRUE, 'seed'),
  ('Époisses', 'fromage', ARRAY['lait'], 342, 'g', TRUE, 'seed'),
  ('Munster', 'fromage', ARRAY['lait'], 316, 'g', TRUE, 'seed'),
  ('Saint-Nectaire', 'fromage', ARRAY['lait'], 340, 'g', TRUE, 'seed'),
  ('Reblochon', 'fromage', ARRAY['lait'], 332, 'g', TRUE, 'seed'),
  ('Tome de Savoie', 'fromage', ARRAY['lait'], 350, 'g', TRUE, 'seed'),
  ('Citrons', 'fruit', ARRAY[]::TEXT[], 29, 'g', TRUE, 'seed'),
  ('Citrons verts (limes)', 'fruit', ARRAY[]::TEXT[], 30, 'g', TRUE, 'seed'),
  ('Oranges', 'fruit', ARRAY[]::TEXT[], 47, 'g', TRUE, 'seed'),
  ('Pamplemousse', 'fruit', ARRAY[]::TEXT[], 42, 'g', TRUE, 'seed'),
  ('Pommes (golden)', 'fruit', ARRAY[]::TEXT[], 52, 'g', TRUE, 'seed'),
  ('Pommes (granny smith)', 'fruit', ARRAY[]::TEXT[], 49, 'g', TRUE, 'seed'),
  ('Poires (conférence)', 'fruit', ARRAY[]::TEXT[], 57, 'g', TRUE, 'seed'),
  ('Pêches', 'fruit', ARRAY[]::TEXT[], 39, 'g', TRUE, 'seed'),
  ('Abricots', 'fruit', ARRAY[]::TEXT[], 48, 'g', TRUE, 'seed'),
  ('Mangue', 'fruit', ARRAY[]::TEXT[], 60, 'g', TRUE, 'seed'),
  ('Ananas', 'fruit', ARRAY[]::TEXT[], 50, 'g', TRUE, 'seed'),
  ('Framboises', 'fruit', ARRAY[]::TEXT[], 52, 'g', TRUE, 'seed'),
  ('Fraises', 'fruit', ARRAY[]::TEXT[], 32, 'g', TRUE, 'seed'),
  ('Myrtilles', 'fruit', ARRAY[]::TEXT[], 57, 'g', TRUE, 'seed'),
  ('Cerises', 'fruit', ARRAY[]::TEXT[], 63, 'g', TRUE, 'seed'),
  ('Raisins (rouge)', 'fruit', ARRAY[]::TEXT[], 69, 'g', TRUE, 'seed'),
  ('Figues fraîches', 'fruit', ARRAY[]::TEXT[], 74, 'g', TRUE, 'seed'),
  ('Figues séchées', 'fruit', ARRAY[]::TEXT[], 249, 'g', TRUE, 'seed'),
  ('Pruneaux', 'fruit', ARRAY[]::TEXT[], 239, 'g', TRUE, 'seed'),
  ('Noix de coco râpée', 'fruit', ARRAY['fruits_a_coque'], 660, 'g', TRUE, 'seed'),
  ('Banane', 'fruit', ARRAY[]::TEXT[], 89, 'g', TRUE, 'seed'),
  ('Kiwi', 'fruit', ARRAY[]::TEXT[], 61, 'g', TRUE, 'seed'),
  ('Grenade (arilles)', 'fruit', ARRAY[]::TEXT[], 83, 'g', TRUE, 'seed'),
  ('Passion (fruits de la passion)', 'fruit', ARRAY[]::TEXT[], 97, 'g', TRUE, 'seed'),
  ('Litchi', 'fruit', ARRAY[]::TEXT[], 66, 'g', TRUE, 'seed'),
  ('Sel fin', 'epice', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Sel de Guérande', 'epice', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Fleur de sel', 'epice', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Poivre noir moulu', 'epice', ARRAY[]::TEXT[], 251, 'g', TRUE, 'seed'),
  ('Poivre blanc', 'epice', ARRAY[]::TEXT[], 296, 'g', TRUE, 'seed'),
  ('Poivre de Sichuan', 'epice', ARRAY[]::TEXT[], 256, 'g', TRUE, 'seed'),
  ('Paprika doux', 'epice', ARRAY[]::TEXT[], 282, 'g', TRUE, 'seed'),
  ('Paprika fumé', 'epice', ARRAY[]::TEXT[], 282, 'g', TRUE, 'seed'),
  ('Piment d''Espelette', 'epice', ARRAY[]::TEXT[], 284, 'g', TRUE, 'seed'),
  ('Piment de Cayenne', 'epice', ARRAY[]::TEXT[], 318, 'g', TRUE, 'seed'),
  ('Cumin moulu', 'epice', ARRAY[]::TEXT[], 375, 'g', TRUE, 'seed'),
  ('Coriandre moulue', 'epice', ARRAY[]::TEXT[], 298, 'g', TRUE, 'seed'),
  ('Curcuma', 'epice', ARRAY[]::TEXT[], 354, 'g', TRUE, 'seed'),
  ('Cannelle moulue', 'epice', ARRAY[]::TEXT[], 247, 'g', TRUE, 'seed'),
  ('Quatre-épices', 'epice', ARRAY[]::TEXT[], 280, 'g', TRUE, 'seed'),
  ('Curry (poudre)', 'epice', ARRAY['celeri'], 325, 'g', TRUE, 'seed'),
  ('Ras el-hanout', 'epice', ARRAY[]::TEXT[], 300, 'g', TRUE, 'seed'),
  ('Muscade moulue', 'epice', ARRAY[]::TEXT[], 525, 'g', TRUE, 'seed'),
  ('Clous de girofle', 'epice', ARRAY[]::TEXT[], 274, 'g', TRUE, 'seed'),
  ('Cardamome', 'epice', ARRAY[]::TEXT[], 311, 'g', TRUE, 'seed'),
  ('Anis étoilé (badiane)', 'epice', ARRAY[]::TEXT[], 337, 'g', TRUE, 'seed'),
  ('Thym séché', 'epice', ARRAY[]::TEXT[], 101, 'g', TRUE, 'seed'),
  ('Thym frais', 'epice', ARRAY[]::TEXT[], 101, 'g', TRUE, 'seed'),
  ('Romarin séché', 'epice', ARRAY[]::TEXT[], 131, 'g', TRUE, 'seed'),
  ('Romarin frais', 'epice', ARRAY[]::TEXT[], 131, 'g', TRUE, 'seed'),
  ('Basilic frais', 'epice', ARRAY[]::TEXT[], 22, 'g', TRUE, 'seed'),
  ('Basilic séché', 'epice', ARRAY[]::TEXT[], 251, 'g', TRUE, 'seed'),
  ('Persil frais', 'epice', ARRAY[]::TEXT[], 36, 'g', TRUE, 'seed'),
  ('Coriandre fraîche', 'epice', ARRAY[]::TEXT[], 23, 'g', TRUE, 'seed'),
  ('Ciboulette fraîche', 'epice', ARRAY[]::TEXT[], 30, 'g', TRUE, 'seed'),
  ('Estragon frais', 'epice', ARRAY[]::TEXT[], 49, 'g', TRUE, 'seed'),
  ('Laurier (feuilles)', 'epice', ARRAY[]::TEXT[], 313, 'g', TRUE, 'seed'),
  ('Sauge fraîche', 'epice', ARRAY[]::TEXT[], 315, 'g', TRUE, 'seed'),
  ('Sarriette', 'epice', ARRAY[]::TEXT[], 272, 'g', TRUE, 'seed'),
  ('Menthe fraîche', 'epice', ARRAY[]::TEXT[], 44, 'g', TRUE, 'seed'),
  ('Cerfeuil frais', 'epice', ARRAY[]::TEXT[], 26, 'g', TRUE, 'seed'),
  ('Moutarde de Dijon', 'epice', ARRAY['moutarde'], 66, 'g', TRUE, 'seed'),
  ('Moutarde à l''ancienne', 'epice', ARRAY['moutarde'], 77, 'g', TRUE, 'seed'),
  ('Wasabi', 'epice', ARRAY[]::TEXT[], 109, 'g', TRUE, 'seed'),
  ('Câpres', 'epice', ARRAY[]::TEXT[], 23, 'g', TRUE, 'seed'),
  ('Huile d''olive extra vierge', 'sauce', ARRAY[]::TEXT[], 884, 'ml', TRUE, 'seed'),
  ('Huile de tournesol', 'sauce', ARRAY[]::TEXT[], 900, 'ml', TRUE, 'seed'),
  ('Huile de colza', 'sauce', ARRAY[]::TEXT[], 900, 'ml', TRUE, 'seed'),
  ('Huile de sésame', 'sauce', ARRAY['sesame'], 884, 'ml', TRUE, 'seed'),
  ('Huile de noix', 'sauce', ARRAY['fruits_a_coque'], 900, 'ml', TRUE, 'seed'),
  ('Fond de veau', 'sauce', ARRAY[]::TEXT[], 18, 'ml', TRUE, 'seed'),
  ('Fond de volaille', 'sauce', ARRAY[]::TEXT[], 15, 'ml', TRUE, 'seed'),
  ('Fond de veau (lié)', 'sauce', ARRAY['gluten'], 35, 'ml', TRUE, 'seed'),
  ('Fumet de poisson', 'sauce', ARRAY['poisson'], 10, 'ml', TRUE, 'seed'),
  ('Vinaigre de vin rouge', 'sauce', ARRAY['so2_sulfites'], 19, 'ml', TRUE, 'seed'),
  ('Vinaigre de vin blanc', 'sauce', ARRAY['so2_sulfites'], 19, 'ml', TRUE, 'seed'),
  ('Vinaigre balsamique', 'sauce', ARRAY['so2_sulfites'], 88, 'ml', TRUE, 'seed'),
  ('Vinaigre de cidre', 'sauce', ARRAY[]::TEXT[], 21, 'ml', TRUE, 'seed'),
  ('Sauce soja', 'sauce', ARRAY['gluten','soja'], 53, 'ml', TRUE, 'seed'),
  ('Sauce soja sucrée (teriyaki)', 'sauce', ARRAY['gluten','soja'], 90, 'ml', TRUE, 'seed'),
  ('Sauce Worcestershire', 'sauce', ARRAY['poisson','so2_sulfites'], 78, 'ml', TRUE, 'seed'),
  ('Sauce tabasco', 'sauce', ARRAY[]::TEXT[], 30, 'ml', TRUE, 'seed'),
  ('Sauce hoisin', 'sauce', ARRAY['soja','sesame','arachides'], 220, 'ml', TRUE, 'seed'),
  ('Sauce huître', 'sauce', ARRAY['mollusques','gluten'], 51, 'ml', TRUE, 'seed'),
  ('Concentré de tomates', 'sauce', ARRAY[]::TEXT[], 82, 'g', TRUE, 'seed'),
  ('Coulis de tomates', 'sauce', ARRAY[]::TEXT[], 35, 'g', TRUE, 'seed'),
  ('Tomates concassées (boîte)', 'sauce', ARRAY[]::TEXT[], 21, 'g', TRUE, 'seed'),
  ('Fond blanc de volaille (poudre)', 'sauce', ARRAY['gluten'], 280, 'g', TRUE, 'seed'),
  ('Bouillon de légumes (poudre)', 'sauce', ARRAY['celeri'], 260, 'g', TRUE, 'seed'),
  ('Sucre blanc (cristal)', 'autre', ARRAY[]::TEXT[], 400, 'g', TRUE, 'seed'),
  ('Sucre glace', 'autre', ARRAY[]::TEXT[], 398, 'g', TRUE, 'seed'),
  ('Sucre roux (cassonade)', 'autre', ARRAY[]::TEXT[], 377, 'g', TRUE, 'seed'),
  ('Sucre de canne complet (rapadura)', 'autre', ARRAY[]::TEXT[], 380, 'g', TRUE, 'seed'),
  ('Miel (fleurs)', 'autre', ARRAY[]::TEXT[], 304, 'g', TRUE, 'seed'),
  ('Sirop d''érable', 'autre', ARRAY[]::TEXT[], 260, 'ml', TRUE, 'seed'),
  ('Glucose (sirop)', 'autre', ARRAY[]::TEXT[], 316, 'g', TRUE, 'seed'),
  ('Œufs frais (calibre M)', 'autre', ARRAY['oeufs'], 143, 'pièce', TRUE, 'seed'),
  ('Œufs (jaune)', 'autre', ARRAY['oeufs'], 322, 'g', TRUE, 'seed'),
  ('Œufs (blanc)', 'autre', ARRAY['oeufs'], 52, 'g', TRUE, 'seed'),
  ('Levure boulangère (fraîche)', 'autre', ARRAY[]::TEXT[], 105, 'g', TRUE, 'seed'),
  ('Levure boulangère (sèche)', 'autre', ARRAY[]::TEXT[], 325, 'g', TRUE, 'seed'),
  ('Levure chimique', 'autre', ARRAY[]::TEXT[], 53, 'g', TRUE, 'seed'),
  ('Bicarbonate de soude', 'autre', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Gélatine (feuilles)', 'autre', ARRAY[]::TEXT[], 335, 'g', TRUE, 'seed'),
  ('Agar-agar', 'autre', ARRAY[]::TEXT[], 247, 'g', TRUE, 'seed'),
  ('Cacao en poudre (non sucré)', 'autre', ARRAY[]::TEXT[], 228, 'g', TRUE, 'seed'),
  ('Chocolat noir 70%', 'autre', ARRAY['so2_sulfites'], 546, 'g', TRUE, 'seed'),
  ('Chocolat au lait', 'autre', ARRAY['lait','so2_sulfites'], 535, 'g', TRUE, 'seed'),
  ('Chocolat blanc', 'autre', ARRAY['lait'], 562, 'g', TRUE, 'seed'),
  ('Pâte de praliné', 'autre', ARRAY['fruits_a_coque'], 544, 'g', TRUE, 'seed'),
  ('Pâte d''amande', 'autre', ARRAY['fruits_a_coque'], 451, 'g', TRUE, 'seed'),
  ('Amandes (entières)', 'autre', ARRAY['fruits_a_coque'], 579, 'g', TRUE, 'seed'),
  ('Amandes (poudre)', 'autre', ARRAY['fruits_a_coque'], 579, 'g', TRUE, 'seed'),
  ('Noisettes', 'autre', ARRAY['fruits_a_coque'], 628, 'g', TRUE, 'seed'),
  ('Noix', 'autre', ARRAY['fruits_a_coque'], 654, 'g', TRUE, 'seed'),
  ('Pistaches', 'autre', ARRAY['fruits_a_coque'], 562, 'g', TRUE, 'seed'),
  ('Pignons de pin', 'autre', ARRAY['fruits_a_coque'], 673, 'g', TRUE, 'seed'),
  ('Noix de cajou', 'autre', ARRAY['fruits_a_coque'], 553, 'g', TRUE, 'seed'),
  ('Arachides (cacahuètes)', 'autre', ARRAY['arachides'], 567, 'g', TRUE, 'seed'),
  ('Sésame (graines)', 'autre', ARRAY['sesame'], 573, 'g', TRUE, 'seed'),
  ('Tahini (pâte de sésame)', 'autre', ARRAY['sesame'], 595, 'g', TRUE, 'seed'),
  ('Lin (graines)', 'autre', ARRAY[]::TEXT[], 534, 'g', TRUE, 'seed'),
  ('Chia (graines)', 'autre', ARRAY[]::TEXT[], 486, 'g', TRUE, 'seed'),
  ('Extrait de vanille', 'autre', ARRAY[]::TEXT[], 288, 'ml', TRUE, 'seed'),
  ('Gousse de vanille', 'autre', ARRAY[]::TEXT[], 288, 'pièce', TRUE, 'seed'),
  ('Rhum ambré (pour cuisine)', 'autre', ARRAY[]::TEXT[], 230, 'ml', TRUE, 'seed'),
  ('Vin blanc sec', 'autre', ARRAY['so2_sulfites'], 70, 'ml', TRUE, 'seed'),
  ('Vin rouge sec', 'autre', ARRAY['so2_sulfites'], 70, 'ml', TRUE, 'seed'),
  ('Porto blanc', 'autre', ARRAY['so2_sulfites'], 152, 'ml', TRUE, 'seed'),
  ('Cognac', 'autre', ARRAY['so2_sulfites'], 230, 'ml', TRUE, 'seed'),
  ('Bière blonde (cuisine)', 'autre', ARRAY['gluten'], 43, 'ml', TRUE, 'seed'),
  ('Vinaigre de framboise', 'sauce', ARRAY['so2_sulfites'], 19, 'ml', TRUE, 'seed'),
  ('Sauce vierge', 'sauce', ARRAY[]::TEXT[], 130, 'ml', TRUE, 'seed'),
  ('Tapenade noire', 'sauce', ARRAY[]::TEXT[], 260, 'g', TRUE, 'seed'),
  ('Pesto basilic', 'sauce', ARRAY['fruits_a_coque','lait'], 430, 'g', TRUE, 'seed'),
  ('Aïoli', 'sauce', ARRAY['oeufs'], 450, 'g', TRUE, 'seed'),
  ('Sauce béarnaise', 'sauce', ARRAY['oeufs','lait','so2_sulfites'], 450, 'g', TRUE, 'seed'),
  ('Sauce hollandaise', 'sauce', ARRAY['oeufs','lait'], 420, 'g', TRUE, 'seed'),
  ('Sauce béchamel', 'sauce', ARRAY['gluten','lait'], 130, 'g', TRUE, 'seed'),
  ('Sauce velouté', 'sauce', ARRAY['gluten'], 80, 'g', TRUE, 'seed'),
  ('Demi-glace', 'sauce', ARRAY[]::TEXT[], 45, 'ml', TRUE, 'seed'),
  ('Gelée de groseille', 'autre', ARRAY[]::TEXT[], 250, 'g', TRUE, 'seed'),
  ('Confiture d''abricot (nappage)', 'autre', ARRAY[]::TEXT[], 250, 'g', TRUE, 'seed'),
  ('Pâte de curry vert', 'epice', ARRAY['poisson'], 180, 'g', TRUE, 'seed'),
  ('Pâte de curry rouge', 'epice', ARRAY['poisson'], 180, 'g', TRUE, 'seed'),
  ('Harissa', 'epice', ARRAY[]::TEXT[], 130, 'g', TRUE, 'seed'),
  ('Chermoula', 'epice', ARRAY[]::TEXT[], 150, 'g', TRUE, 'seed'),
  ('Herbes de Provence', 'epice', ARRAY[]::TEXT[], 265, 'g', TRUE, 'seed'),
  ('Bouquet garni', 'epice', ARRAY[]::TEXT[], 50, 'pièce', TRUE, 'seed'),
  ('Miso blanc', 'sauce', ARRAY['soja','gluten'], 199, 'g', TRUE, 'seed'),
  ('Miso rouge', 'sauce', ARRAY['soja','gluten'], 218, 'g', TRUE, 'seed'),
  ('Tempura (farine)', 'feculent', ARRAY['gluten','oeufs'], 350, 'g', TRUE, 'seed'),
  ('Nori (feuilles)', 'autre', ARRAY[]::TEXT[], 35, 'g', TRUE, 'seed'),
  ('Wakamé', 'legume', ARRAY[]::TEXT[], 45, 'g', TRUE, 'seed'),
  ('Olives noires (dénoyautées)', 'autre', ARRAY[]::TEXT[], 145, 'g', TRUE, 'seed'),
  ('Olives vertes (dénoyautées)', 'autre', ARRAY[]::TEXT[], 115, 'g', TRUE, 'seed'),
  ('Cornichons', 'autre', ARRAY[]::TEXT[], 15, 'g', TRUE, 'seed'),
  ('Tomates séchées', 'legume', ARRAY[]::TEXT[], 258, 'g', TRUE, 'seed'),
  ('Poivrons rôtis (bocal)', 'legume', ARRAY[]::TEXT[], 28, 'g', TRUE, 'seed'),
  ('Artichauts (cœurs bocal)', 'legume', ARRAY[]::TEXT[], 50, 'g', TRUE, 'seed'),
  ('Haricots blancs (boîte)', 'feculent', ARRAY[]::TEXT[], 95, 'g', TRUE, 'seed'),
  ('Haricots rouges (boîte)', 'feculent', ARRAY[]::TEXT[], 100, 'g', TRUE, 'seed'),
  ('Pois cassés', 'feculent', ARRAY[]::TEXT[], 340, 'g', TRUE, 'seed'),
  ('Fèves', 'legume', ARRAY[]::TEXT[], 88, 'g', TRUE, 'seed'),
  ('Edamame', 'legume', ARRAY['soja'], 122, 'g', TRUE, 'seed'),
  ('Avocat', 'fruit', ARRAY[]::TEXT[], 160, 'g', TRUE, 'seed'),
  ('Papaye', 'fruit', ARRAY[]::TEXT[], 43, 'g', TRUE, 'seed'),
  ('Melon (charentais)', 'fruit', ARRAY[]::TEXT[], 34, 'g', TRUE, 'seed'),
  ('Pastèque', 'fruit', ARRAY[]::TEXT[], 30, 'g', TRUE, 'seed'),
  ('Groseilles', 'fruit', ARRAY[]::TEXT[], 56, 'g', TRUE, 'seed'),
  ('Mûres', 'fruit', ARRAY[]::TEXT[], 43, 'g', TRUE, 'seed'),
  ('Cassis', 'fruit', ARRAY[]::TEXT[], 63, 'g', TRUE, 'seed'),
  ('Dattes (Medjool)', 'fruit', ARRAY[]::TEXT[], 277, 'g', TRUE, 'seed'),
  ('Tapioca (perles)', 'feculent', ARRAY[]::TEXT[], 358, 'g', TRUE, 'seed'),
  ('Vermicelles de riz', 'feculent', ARRAY[]::TEXT[], 360, 'g', TRUE, 'seed'),
  ('Nouilles soba', 'feculent', ARRAY['gluten'], 337, 'g', TRUE, 'seed'),
  ('Galettes de riz (crêpes)', 'feculent', ARRAY[]::TEXT[], 346, 'g', TRUE, 'seed'),
  ('Panko (chapelure japonaise)', 'feculent', ARRAY['gluten'], 385, 'g', TRUE, 'seed'),
  ('Crêpe dentelle (brisures)', 'feculent', ARRAY['gluten','lait','oeufs'], 490, 'g', TRUE, 'seed'),
  ('Blinis', 'feculent', ARRAY['gluten','oeufs','lait'], 225, 'pièce', TRUE, 'seed'),
  ('Tortillas de blé', 'feculent', ARRAY['gluten'], 316, 'g', TRUE, 'seed'),
  ('Galettes de blé noir', 'feculent', ARRAY[]::TEXT[], 200, 'pièce', TRUE, 'seed'),
  ('Œufs de caille', 'autre', ARRAY['oeufs'], 158, 'pièce', TRUE, 'seed'),
  ('Anchois (filets en conserve)', 'poisson', ARRAY['poisson'], 210, 'g', TRUE, 'seed'),
  ('Bottarga', 'poisson', ARRAY['poisson'], 380, 'g', TRUE, 'seed'),
  ('Tarama', 'poisson', ARRAY['poisson','oeufs'], 500, 'g', TRUE, 'seed'),
  ('Hareng fumé (filet)', 'poisson', ARRAY['poisson'], 217, 'g', TRUE, 'seed'),
  ('Truite fumée', 'poisson', ARRAY['poisson'], 190, 'g', TRUE, 'seed'),
  ('Anguille fumée', 'poisson', ARRAY['poisson'], 289, 'g', TRUE, 'seed'),
  ('Oursin (corail)', 'poisson', ARRAY['mollusques'], 110, 'g', TRUE, 'seed'),
  ('Encornets (calmars grillés)', 'poisson', ARRAY['mollusques'], 90, 'g', TRUE, 'seed'),
  ('Seiche', 'poisson', ARRAY['mollusques'], 79, 'g', TRUE, 'seed'),
  ('Bulots', 'poisson', ARRAY['mollusques'], 78, 'g', TRUE, 'seed'),
  ('Coques', 'poisson', ARRAY['mollusques'], 76, 'g', TRUE, 'seed'),
  ('Bigorneaux', 'poisson', ARRAY['mollusques'], 60, 'g', TRUE, 'seed'),
  ('Cresson', 'legume', ARRAY[]::TEXT[], 32, 'g', TRUE, 'seed'),
  ('Pourpier', 'legume', ARRAY[]::TEXT[], 16, 'g', TRUE, 'seed'),
  ('Oxalis', 'legume', ARRAY[]::TEXT[], 20, 'g', TRUE, 'seed'),
  ('Fleurs comestibles', 'legume', ARRAY[]::TEXT[], 50, 'g', TRUE, 'seed'),
  ('Pousses de tournesol', 'legume', ARRAY[]::TEXT[], 50, 'g', TRUE, 'seed'),
  ('Germes de soja', 'legume', ARRAY['soja'], 30, 'g', TRUE, 'seed'),
  ('Chou kale', 'legume', ARRAY[]::TEXT[], 49, 'g', TRUE, 'seed'),
  ('Blettes', 'legume', ARRAY[]::TEXT[], 20, 'g', TRUE, 'seed'),
  ('Oseille', 'legume', ARRAY[]::TEXT[], 22, 'g', TRUE, 'seed'),
  ('Pissenlit', 'legume', ARRAY[]::TEXT[], 45, 'g', TRUE, 'seed'),
  ('Topinambour', 'legume', ARRAY[]::TEXT[], 76, 'g', TRUE, 'seed'),
  ('Salsifis', 'legume', ARRAY[]::TEXT[], 82, 'g', TRUE, 'seed'),
  ('Rhubarbe', 'fruit', ARRAY[]::TEXT[], 21, 'g', TRUE, 'seed'),
  ('Sureau (fleurs de)', 'fruit', ARRAY[]::TEXT[], 40, 'g', TRUE, 'seed'),
  ('Acide citrique', 'epice', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Zeste de citron (confit)', 'epice', ARRAY[]::TEXT[], 167, 'g', TRUE, 'seed'),
  ('Citron confit (à la marocaine)', 'epice', ARRAY[]::TEXT[], 30, 'g', TRUE, 'seed'),
  ('Poivre long de Java', 'epice', ARRAY[]::TEXT[], 250, 'g', TRUE, 'seed'),
  ('Safran', 'epice', ARRAY[]::TEXT[], 310, 'g', TRUE, 'seed'),
  ('Fenugrec (graines)', 'epice', ARRAY[]::TEXT[], 323, 'g', TRUE, 'seed'),
  ('Za''atar', 'epice', ARRAY['sesame'], 285, 'g', TRUE, 'seed'),
  ('Sumac', 'epice', ARRAY[]::TEXT[], 279, 'g', TRUE, 'seed'),
  ('Shichimi togarashi', 'epice', ARRAY['sesame'], 300, 'g', TRUE, 'seed'),
  ('Panch phoron', 'epice', ARRAY[]::TEXT[], 290, 'g', TRUE, 'seed'),
  ('Graines de moutarde', 'epice', ARRAY['moutarde'], 469, 'g', TRUE, 'seed'),
  ('Papier d''ail (ail en poudre)', 'epice', ARRAY[]::TEXT[], 331, 'g', TRUE, 'seed'),
  ('Oignon en poudre', 'epice', ARRAY[]::TEXT[], 341, 'g', TRUE, 'seed'),
  ('Café espresso (pour cuisine)', 'autre', ARRAY[]::TEXT[], 2, 'ml', TRUE, 'seed'),
  ('Thé matcha (poudre)', 'autre', ARRAY[]::TEXT[], 324, 'g', TRUE, 'seed'),
  ('Eau de fleur d''oranger', 'autre', ARRAY[]::TEXT[], 10, 'ml', TRUE, 'seed'),
  ('Eau de rose', 'autre', ARRAY[]::TEXT[], 10, 'ml', TRUE, 'seed'),
  ('Kirsch (cerise)', 'autre', ARRAY[]::TEXT[], 240, 'ml', TRUE, 'seed'),
  ('Grand Marnier', 'autre', ARRAY[]::TEXT[], 240, 'ml', TRUE, 'seed'),
  ('Calvados', 'autre', ARRAY[]::TEXT[], 230, 'ml', TRUE, 'seed'),
  ('Amaretto', 'autre', ARRAY['fruits_a_coque'], 310, 'ml', TRUE, 'seed'),
  ('Marsala (vin sicilien)', 'autre', ARRAY['so2_sulfites'], 150, 'ml', TRUE, 'seed'),
  ('Vermouth blanc', 'autre', ARRAY['so2_sulfites'], 120, 'ml', TRUE, 'seed'),
  ('Pastis (pour cuisine)', 'autre', ARRAY['so2_sulfites'], 230, 'ml', TRUE, 'seed'),
  ('Encre de seiche', 'sauce', ARRAY['mollusques'], 50, 'g', TRUE, 'seed'),
  ('Furikake', 'epice', ARRAY['poisson','sesame'], 330, 'g', TRUE, 'seed'),
  ('Mirin', 'sauce', ARRAY['gluten'], 235, 'ml', TRUE, 'seed'),
  ('Saké (pour cuisine)', 'sauce', ARRAY['gluten'], 134, 'ml', TRUE, 'seed'),
  ('Nam pla (sauce de poisson)', 'sauce', ARRAY['poisson'], 43, 'ml', TRUE, 'seed'),
  ('Nuoc-mâm', 'sauce', ARRAY['poisson'], 43, 'ml', TRUE, 'seed'),
  ('Kimchi', 'legume', ARRAY[]::TEXT[], 15, 'g', TRUE, 'seed'),
  ('Choucroute (crue)', 'legume', ARRAY[]::TEXT[], 19, 'g', TRUE, 'seed'),
  ('Vinaigre de Modène IGP', 'sauce', ARRAY['so2_sulfites'], 100, 'ml', TRUE, 'seed'),
  ('Crème de marrons', 'autre', ARRAY['fruits_a_coque'], 268, 'g', TRUE, 'seed'),
  ('Praliné (pâte)', 'autre', ARRAY['fruits_a_coque'], 544, 'g', TRUE, 'seed'),
  ('Gianduja', 'autre', ARRAY['fruits_a_coque','lait'], 540, 'g', TRUE, 'seed'),
  ('Nougat blanc', 'autre', ARRAY['fruits_a_coque','oeufs'], 400, 'g', TRUE, 'seed'),
  ('Caramel (beurre salé)', 'sauce', ARRAY['lait'], 420, 'g', TRUE, 'seed'),
  ('Dulce de leche', 'sauce', ARRAY['lait'], 328, 'g', TRUE, 'seed'),
  ('Crème anglaise', 'sauce', ARRAY['lait','oeufs'], 130, 'ml', TRUE, 'seed'),
  ('Coulis de framboise', 'sauce', ARRAY[]::TEXT[], 50, 'ml', TRUE, 'seed'),
  ('Coulis de fruit de la passion', 'sauce', ARRAY[]::TEXT[], 70, 'ml', TRUE, 'seed'),
  ('Sorbet citron (chef)', 'autre', ARRAY[]::TEXT[], 130, 'g', TRUE, 'seed'),
  ('Glace vanille (artisanale)', 'autre', ARRAY['lait','oeufs'], 207, 'g', TRUE, 'seed'),
  ('Guimauve', 'autre', ARRAY[]::TEXT[], 318, 'g', TRUE, 'seed'),
  ('Pain d''épices', 'feculent', ARRAY['gluten','so2_sulfites'], 368, 'g', TRUE, 'seed'),
  ('Financier (base)', 'feculent', ARRAY['gluten','lait','oeufs','fruits_a_coque'], 430, 'g', TRUE, 'seed'),
  ('Poudre de noisettes', 'autre', ARRAY['fruits_a_coque'], 628, 'g', TRUE, 'seed'),
  ('Pralin en grains', 'autre', ARRAY['fruits_a_coque'], 580, 'g', TRUE, 'seed'),
  ('Feuilletine', 'feculent', ARRAY['gluten','lait'], 450, 'g', TRUE, 'seed'),
  ('Soja texturé', 'autre', ARRAY['soja'], 329, 'g', TRUE, 'seed'),
  ('Tofu ferme', 'autre', ARRAY['soja'], 76, 'g', TRUE, 'seed'),
  ('Tempeh', 'autre', ARRAY['soja'], 195, 'g', TRUE, 'seed'),
  ('Seitan', 'autre', ARRAY['gluten'], 370, 'g', TRUE, 'seed'),
  ('Jackfruit jeune', 'legume', ARRAY[]::TEXT[], 95, 'g', TRUE, 'seed'),
  ('Algues kombu', 'legume', ARRAY[]::TEXT[], 43, 'g', TRUE, 'seed'),
  ('Levure nutritionnelle', 'autre', ARRAY[]::TEXT[], 370, 'g', TRUE, 'seed'),
  ('Huile de coco vierge', 'sauce', ARRAY[]::TEXT[], 862, 'ml', TRUE, 'seed'),
  ('Aquafaba (eau de pois chiches)', 'sauce', ARRAY[]::TEXT[], 10, 'ml', TRUE, 'seed'),
  ('Teff (farine)', 'feculent', ARRAY[]::TEXT[], 363, 'g', TRUE, 'seed'),
  ('Millet', 'feculent', ARRAY[]::TEXT[], 378, 'g', TRUE, 'seed'),
  ('Amarante', 'feculent', ARRAY[]::TEXT[], 371, 'g', TRUE, 'seed'),
  ('Son d''avoine', 'feculent', ARRAY['gluten'], 246, 'g', TRUE, 'seed'),
  ('Flocons d''avoine', 'feculent', ARRAY['gluten'], 389, 'g', TRUE, 'seed'),
  ('Poivre de Kampot', 'epice', ARRAY[]::TEXT[], 255, 'g', TRUE, 'seed'),
  ('Baies de Timut', 'epice', ARRAY[]::TEXT[], 260, 'g', TRUE, 'seed'),
  ('Poivre de Voatsiperifery', 'epice', ARRAY[]::TEXT[], 252, 'g', TRUE, 'seed'),
  ('Piment ancho', 'epice', ARRAY[]::TEXT[], 281, 'g', TRUE, 'seed'),
  ('Chipotles (piment fumé)', 'epice', ARRAY[]::TEXT[], 284, 'g', TRUE, 'seed'),
  ('Galanga', 'epice', ARRAY[]::TEXT[], 70, 'g', TRUE, 'seed'),
  ('Citronnelle', 'epice', ARRAY[]::TEXT[], 99, 'g', TRUE, 'seed'),
  ('Feuilles de kaffir (combava)', 'epice', ARRAY[]::TEXT[], 48, 'g', TRUE, 'seed'),
  ('Tamarin (pâte)', 'epice', ARRAY[]::TEXT[], 239, 'g', TRUE, 'seed'),
  ('Gingembre frais', 'epice', ARRAY[]::TEXT[], 80, 'g', TRUE, 'seed'),
  ('Gingembre confit', 'epice', ARRAY[]::TEXT[], 336, 'g', TRUE, 'seed'),
  ('Pâte d''umeboshi', 'sauce', ARRAY[]::TEXT[], 50, 'g', TRUE, 'seed'),
  ('Bonito séché (katsuobushi)', 'poisson', ARRAY['poisson'], 335, 'g', TRUE, 'seed'),
  ('Kombu (algue séchée)', 'legume', ARRAY[]::TEXT[], 235, 'g', TRUE, 'seed'),
  ('Boudin blanc', 'viande', ARRAY['lait','oeufs','gluten'], 247, 'g', TRUE, 'seed'),
  ('Joue de porc', 'viande', ARRAY[]::TEXT[], 220, 'g', TRUE, 'seed'),
  ('Pintade (cuisse)', 'viande', ARRAY[]::TEXT[], 158, 'g', TRUE, 'seed'),
  ('Jarret de bœuf', 'viande', ARRAY[]::TEXT[], 190, 'g', TRUE, 'seed'),
  ('Veau (jarret)', 'viande', ARRAY[]::TEXT[], 175, 'g', TRUE, 'seed'),
  ('Saint-Pierre (filet)', 'poisson', ARRAY['poisson'], 87, 'g', TRUE, 'seed'),
  ('Palourdes', 'poisson', ARRAY['mollusques'], 77, 'g', TRUE, 'seed'),
  ('Pétoncles', 'poisson', ARRAY['mollusques'], 88, 'g', TRUE, 'seed'),
  ('Raie (aile)', 'poisson', ARRAY['poisson'], 95, 'g', TRUE, 'seed'),
  ('Limande-sole (filet)', 'poisson', ARRAY['poisson'], 83, 'g', TRUE, 'seed'),
  ('Pak choï', 'legume', ARRAY[]::TEXT[], 13, 'g', TRUE, 'seed'),
  ('Gombo', 'legume', ARRAY[]::TEXT[], 33, 'g', TRUE, 'seed'),
  ('Romanesco', 'legume', ARRAY[]::TEXT[], 25, 'g', TRUE, 'seed'),
  ('Mizuna', 'legume', ARRAY[]::TEXT[], 13, 'g', TRUE, 'seed'),
  ('Taro', 'legume', ARRAY[]::TEXT[], 112, 'g', TRUE, 'seed'),
  ('Chayotte', 'legume', ARRAY[]::TEXT[], 19, 'g', TRUE, 'seed'),
  ('Crosnes', 'legume', ARRAY[]::TEXT[], 66, 'g', TRUE, 'seed'),
  ('Chicorée (frisée)', 'legume', ARRAY[]::TEXT[], 23, 'g', TRUE, 'seed'),
  ('Nigelle (graines)', 'epice', ARRAY[]::TEXT[], 345, 'g', TRUE, 'seed'),
  ('Berbéré (mélange)', 'epice', ARRAY[]::TEXT[], 278, 'g', TRUE, 'seed'),
  ('Sansho (poivre japonais)', 'epice', ARRAY[]::TEXT[], 300, 'g', TRUE, 'seed'),
  ('Dukkah', 'epice', ARRAY['fruits_a_coque','graines_de_sesame'], 520, 'g', TRUE, 'seed'),
  ('Assaisonnement cajun', 'epice', ARRAY[]::TEXT[], 265, 'g', TRUE, 'seed'),
  ('Orge perlé', 'feculent', ARRAY['gluten'], 352, 'g', TRUE, 'seed'),
  ('Épeautre (grains)', 'feculent', ARRAY['gluten'], 338, 'g', TRUE, 'seed'),
  ('Udon (nouilles fraîches)', 'feculent', ARRAY['gluten'], 130, 'g', TRUE, 'seed'),
  ('Vermicelles de soja', 'feculent', ARRAY['soja'], 352, 'g', TRUE, 'seed'),
  ('Farro', 'feculent', ARRAY['gluten'], 340, 'g', TRUE, 'seed'),
  ('Pesto roquette', 'sauce', ARRAY['fruits_a_coque','lait'], 430, 'g', TRUE, 'seed'),
  ('Sauce chimichurri', 'sauce', ARRAY[]::TEXT[], 180, 'g', TRUE, 'seed'),
  ('Sauce romesco', 'sauce', ARRAY['fruits_a_coque'], 220, 'g', TRUE, 'seed'),
  ('Sauce tzatziki', 'sauce', ARRAY['lait'], 95, 'g', TRUE, 'seed'),
  ('Fourme d''Ambert', 'fromage', ARRAY['lait'], 340, 'g', TRUE, 'seed'),
  ('Ossau-Iraty', 'fromage', ARRAY['lait'], 380, 'g', TRUE, 'seed'),
  ('Morbier', 'fromage', ARRAY['lait'], 305, 'g', TRUE, 'seed'),
  ('Crottin de Chavignol', 'fromage', ARRAY['lait'], 360, 'g', TRUE, 'seed'),
  ('Fromage blanc 0%', 'laitage', ARRAY['lait'], 44, 'g', TRUE, 'seed'),
  ('Kéfir', 'laitage', ARRAY['lait'], 61, 'g', TRUE, 'seed'),
  ('Kaki (persimmon)', 'fruit', ARRAY[]::TEXT[], 70, 'g', TRUE, 'seed'),
  ('Physalis', 'fruit', ARRAY[]::TEXT[], 53, 'g', TRUE, 'seed'),
  ('Mirabelle', 'fruit', ARRAY[]::TEXT[], 54, 'g', TRUE, 'seed'),
  ('Quetsche', 'fruit', ARRAY[]::TEXT[], 47, 'g', TRUE, 'seed'),
  ('Goyave', 'fruit', ARRAY[]::TEXT[], 68, 'g', TRUE, 'seed'),
  ('Gomme xanthane', 'autre', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Charbon végétal actif', 'autre', ARRAY[]::TEXT[], 0, 'g', TRUE, 'seed'),
  ('Sel de céleri', 'autre', ARRAY['celeri'], 0, 'g', TRUE, 'seed')
ON CONFLICT DO NOTHING;-- Migration 000007 : Feature flags beta + paramètres globaux
-- Permet d'activer/désactiver des features par restaurant sans redéploiement

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  flag TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, flag)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flags_select" ON feature_flags;
CREATE POLICY "flags_select" ON feature_flags FOR SELECT USING (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "flags_insert" ON feature_flags;
CREATE POLICY "flags_insert" ON feature_flags FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
DROP POLICY IF EXISTS "flags_update" ON feature_flags;
CREATE POLICY "flags_update" ON feature_flags FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- Table des invitations beta (suivi des testeurs invités)
CREATE TABLE IF NOT EXISTS beta_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  restaurant_id UUID REFERENCES restaurants(id),
  notes TEXT
);

-- beta_invitations accessible uniquement en service role (admin)
-- Pas de RLS public — gérée via scripts/invite-beta.js uniquement

-- Index sur flag pour lookups rapides
CREATE INDEX IF NOT EXISTS idx_feature_flags_restaurant_flag ON feature_flags(restaurant_id, flag);

-- Flags beta par défaut pour les restaurants existants (si applicable)
-- Les nouveaux restaurants héritent des defaults via code applicatif
-- Migration 000008 : colonnes manquantes sur la table ventes
-- mode_saisie, nb_couverts, panier_moyen, montant_total, notes

ALTER TABLE ventes
  ADD COLUMN IF NOT EXISTS mode_saisie TEXT CHECK (mode_saisie IN ('simple', 'detail')) DEFAULT 'detail',
  ADD COLUMN IF NOT EXISTS nb_couverts INTEGER,
  ADD COLUMN IF NOT EXISTS panier_moyen DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS montant_total DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS notes TEXT;
-- Création du bucket dish-photos pour les photos de plats
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dish-photos',
  'dish-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;
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
-- Migration 000011 : table subscriptions + feature flags plan
-- Stripe intégration — beta testeurs = gratuit (aucune row = plan freemium)

CREATE TABLE IF NOT EXISTS subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON subscriptions(restaurant_id);

-- RLS : chaque restaurant voit uniquement son abonnement
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Fonction : limites par plan (freemium si pas de subscription active)
CREATE OR REPLACE FUNCTION get_plan_limits(p_restaurant_id UUID)
RETURNS JSONB AS $$
  SELECT COALESCE(
    (SELECT CASE
      WHEN s.plan = 'starter' THEN '{"max_plats": 5, "max_fournisseurs": 2, "pms": false}'::JSONB
      WHEN s.plan = 'pro'     THEN '{"max_plats": -1, "max_fournisseurs": -1, "pms": true}'::JSONB
      WHEN s.plan = 'multi'   THEN '{"max_plats": -1, "max_fournisseurs": -1, "pms": true, "multi_etablissement": true}'::JSONB
      ELSE '{"max_plats": 3, "max_fournisseurs": 1, "pms": false}'::JSONB
    END
    FROM subscriptions s
    WHERE s.restaurant_id = p_restaurant_id
      AND s.statut IN ('active', 'trialing')
    ORDER BY s.created_at DESC
    LIMIT 1),
    -- Aucune subscription = freemium
    '{"max_plats": 3, "max_fournisseurs": 1, "pms": false}'::JSONB
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
