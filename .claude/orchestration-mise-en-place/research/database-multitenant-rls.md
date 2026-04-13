# Recherche : Base de Données Multi-Tenant + RLS

**Date**: 2026-04-12
**Stack**: Supabase PostgreSQL + RLS + Triggers + Edge Functions

---

## 1. Schéma complet — Toutes les tables

```sql
-- ══════════════════════════════════════════════
-- CORE : Multi-tenant foundation
-- ══════════════════════════════════════════════

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('restaurant', 'food_truck', 'traiteur', 'brasserie')),
  adresse JSONB,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parametres JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE restaurant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'chef', 'manager')) DEFAULT 'chef',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

-- ══════════════════════════════════════════════
-- CATALOGUE INGRÉDIENTS (global + restaurant)
-- ══════════════════════════════════════════════

CREATE TABLE ingredients_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  categorie TEXT,
  allergenes TEXT[] DEFAULT '{}',
  kcal_par_100g DECIMAL(8,2),
  unite_standard TEXT DEFAULT 'g',
  is_verified BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingredients_catalog_nom ON ingredients_catalog USING GIN (to_tsvector('french', nom));

CREATE TABLE restaurant_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES ingredients_catalog(id),
  nom_custom TEXT,
  allergenes_override TEXT[],
  kcal_override DECIMAL(8,2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Si catalog_id IS NULL → ingrédient maison
  -- Si catalog_id IS SET → étend le catalogue
  CONSTRAINT nom_required CHECK (catalog_id IS NOT NULL OR nom_custom IS NOT NULL)
);

-- Vue combinée : nom effectif + allergènes effectifs
CREATE VIEW ingredients_view AS
SELECT
  ri.id,
  ri.restaurant_id,
  COALESCE(ri.nom_custom, ic.nom) AS nom,
  COALESCE(ri.allergenes_override, ic.allergenes, '{}') AS allergenes,
  COALESCE(ri.kcal_override, ic.kcal_par_100g) AS kcal_par_100g,
  ic.unite_standard,
  ri.catalog_id,
  ri.created_at
FROM restaurant_ingredients ri
LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
WHERE ri.deleted_at IS NULL;

-- ══════════════════════════════════════════════
-- PILIER OPÉRER
-- ══════════════════════════════════════════════

CREATE TABLE plats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  photo_url TEXT,
  instructions TEXT,
  statut TEXT CHECK (statut IN ('actif', 'archive', 'brouillon')) DEFAULT 'brouillon',
  cout_de_revient DECIMAL(8,2),  -- calculé automatiquement par trigger
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fiche_technique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  grammage DECIMAL(8,2) NOT NULL,
  unite TEXT DEFAULT 'g',
  ordre INTEGER DEFAULT 0,
  fournisseur_id_habituel UUID,  -- FK vers fournisseurs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versioning des fiches techniques (JSONB snapshot)
CREATE TABLE fiche_technique_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  ingredients_snapshot JSONB NOT NULL,
  cout_calcule DECIMAL(8,2),
  modifie_par UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fiche_mise_en_place (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  etapes JSONB DEFAULT '[]',    -- [{ordre, description, duree_minutes}]
  temps_prep_total INTEGER,
  materiel JSONB DEFAULT '[]',  -- [{nom, quantite}]
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- PILIER ACHETER
-- ══════════════════════════════════════════════

CREATE TABLE fournisseurs (
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

CREATE TABLE mercuriale (
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

CREATE INDEX idx_mercuriale_ingredient_actif ON mercuriale(ingredient_id, est_actif);

CREATE TABLE bons_de_commande (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_souhaitee DATE,
  statut TEXT CHECK (statut IN ('brouillon', 'envoye', 'confirme', 'recu')) DEFAULT 'brouillon',
  total_ht DECIMAL(10,2),
  notes TEXT,
  envoye_via TEXT,  -- 'whatsapp' | 'email' | 'pdf'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bon_de_commande_lignes (
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

CREATE TABLE ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  plat_id UUID REFERENCES plats(id),
  quantite INTEGER NOT NULL,
  prix_vente DECIMAL(8,2),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  service TEXT CHECK (service IN ('midi', 'soir', 'continu')) DEFAULT 'midi',
  source TEXT DEFAULT 'manual',  -- 'manual' | 'lightspeed' | 'zelty' | 'tiller'
  external_id TEXT,              -- ID POS pour déduplication
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, external_id, source)  -- évite les doublons webhook
);

CREATE TABLE charges (
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

CREATE TABLE masse_salariale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  mois DATE NOT NULL,  -- premier jour du mois
  montant_brut DECIMAL(10,2) NOT NULL,
  nb_employes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, mois)
);

-- ══════════════════════════════════════════════
-- CONTRÔLE DES ÉCARTS (vues, pas tables)
-- ══════════════════════════════════════════════

-- Inventaire théorique (calculé depuis ventes × grammages)
CREATE VIEW inventaire_theorique AS
SELECT
  ft.ingredient_id,
  v.restaurant_id,
  v.date,
  SUM(v.quantite * ft.grammage) AS quantite_consommee_theorique,
  iv.unite_standard
FROM ventes v
JOIN fiche_technique ft ON ft.plat_id = v.plat_id
JOIN ingredients_view iv ON iv.id = ft.ingredient_id
GROUP BY ft.ingredient_id, v.restaurant_id, v.date, iv.unite_standard;

CREATE TABLE inventaire_reel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  quantite DECIMAL(10,3) NOT NULL,
  unite TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- MODULE PMS
-- ══════════════════════════════════════════════

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
  conforme BOOLEAN GENERATED ALWAYS AS (
    valeur >= (SELECT temp_min FROM equipements WHERE id = equipement_id) AND
    valeur <= (SELECT temp_max FROM equipements WHERE id = equipement_id)
  ) STORED,
  action_corrective TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()  -- JAMAIS de UPDATE sur cette table
);

CREATE INDEX idx_temp_logs_restaurant_date ON temperature_logs(restaurant_id, created_at DESC);

CREATE TABLE nettoyage_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT CHECK (type IN ('pre_service', 'post_service', 'hebdo', 'mensuel')),
  items JSONB DEFAULT '[]',  -- [{id, description, obligatoire}]
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nettoyage_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES nettoyage_checklists(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items_valides JSONB DEFAULT '[]',  -- [{id, validé, note}]
  signature_url TEXT,
  photo_url TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  duree_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  date_expiration DATE,  -- NULL (aucun renouvellement légalement requis)
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- EVENT LOG (transverse)
-- ══════════════════════════════════════════════

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_restaurant_type ON events(restaurant_id, type, created_at DESC);
```

---

## 2. RLS — Politiques complètes

```sql
-- Fonction helper : obtenir le restaurant_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Pattern à répliquer sur TOUTES les tables
-- (exemple sur plats, appliquer identiquement sur toutes les autres)

ALTER TABLE plats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plats_select" ON plats
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "plats_insert" ON plats
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "plats_update" ON plats
  FOR UPDATE USING (restaurant_id = get_user_restaurant_id())
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "plats_delete" ON plats
  FOR DELETE USING (
    restaurant_id = get_user_restaurant_id() AND
    EXISTS (
      SELECT 1 FROM restaurant_users
      WHERE user_id = auth.uid()
      AND restaurant_id = plats.restaurant_id
      AND role IN ('owner', 'manager')
    )
  );

-- Cas spécial temperature_logs : LECTURE SEULE (jamais UPDATE/DELETE pour conformité)
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_logs_select" ON temperature_logs
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "temp_logs_insert" ON temperature_logs
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

-- PAS de politique UPDATE ni DELETE sur temperature_logs → immutabilité légale
```

---

## 3. Trigger cascade prix → coûts

```sql
-- Extension pg_net pour appeler Edge Functions depuis triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger sur UPDATE de mercuriale
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
BEGIN
  -- Appel asynchrone à l'Edge Function (non-bloquant)
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/recalculate-costs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_mercuriale_update
  AFTER INSERT OR UPDATE OF prix ON mercuriale
  FOR EACH ROW
  WHEN (NEW.est_actif = TRUE)
  EXECUTE FUNCTION trigger_recalculate_costs();
```

```typescript
// supabase/functions/recalculate-costs/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { ingredient_id, nouveau_prix } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupérer toutes les fiches techniques utilisant cet ingrédient
  const { data: lignes } = await supabase
    .from('fiche_technique')
    .select('plat_id, grammage, unite')
    .eq('ingredient_id', ingredient_id)

  if (!lignes?.length) return new Response(JSON.stringify({ updated: 0 }))

  const platIds = [...new Set(lignes.map(l => l.plat_id))]
  
  // Recalculer le coût de chaque plat
  for (const platId of platIds) {
    const { data: allLignes } = await supabase
      .from('fiche_technique')
      .select(`grammage, ingredient_id, mercuriale!inner(prix)`)
      .eq('plat_id', platId)
    
    const cout = allLignes?.reduce((sum, l) => {
      const prix = l.mercuriale?.[0]?.prix ?? 0
      return sum + (l.grammage / 1000) * prix
    }, 0) ?? 0

    await supabase
      .from('plats')
      .update({ cout_de_revient: cout, updated_at: new Date().toISOString() })
      .eq('id', platId)

    // Versionner la fiche
    await supabase.from('fiche_technique_versions').insert({
      plat_id: platId,
      version_number: Date.now(),
      ingredients_snapshot: allLignes,
      cout_calcule: cout
    })
  }

  return new Response(JSON.stringify({ updated: platIds.length }))
})
```

---

## 4. pg_cron — Jobs récurrents

```sql
-- Activer pg_cron (disponible sur Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Archivage PMS data > 3 ans (chaque dimanche 2h)
SELECT cron.schedule(
  'archive-old-pms-data',
  '0 2 * * 0',
  $$
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  SELECT
    'pms-archive',
    'temperature_logs/' || extract(year from created_at) || '/' || extract(month from created_at) || '.json',
    NULL,
    jsonb_build_object('data', jsonb_agg(row_to_json(t)))
  FROM temperature_logs t
  WHERE created_at < NOW() - INTERVAL '3 years'
  GROUP BY extract(year from created_at), extract(month from created_at)
  ON CONFLICT DO NOTHING;

  DELETE FROM temperature_logs WHERE created_at < NOW() - INTERVAL '3 years';
  $$
);
```

---

## 5. Full-text Search — Recherche ingrédients

```sql
-- Index ts_vector sur le catalogue
ALTER TABLE ingredients_catalog 
  ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('french', nom || ' ' || COALESCE(categorie, ''))) STORED;

CREATE INDEX idx_ingredients_search ON ingredients_catalog USING GIN (search_vector);

-- Recherche combinée : catalogue + ingrédients restaurant
CREATE OR REPLACE FUNCTION search_ingredients(
  p_query TEXT,
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  nom TEXT,
  source TEXT,
  allergenes TEXT[],
  score REAL
) AS $$
  -- Ingrédients du restaurant d'abord
  SELECT
    ri.id,
    COALESCE(ri.nom_custom, ic.nom) AS nom,
    'restaurant' AS source,
    COALESCE(ri.allergenes_override, ic.allergenes, '{}') AS allergenes,
    1.0::REAL AS score
  FROM restaurant_ingredients ri
  LEFT JOIN ingredients_catalog ic ON ri.catalog_id = ic.id
  WHERE ri.restaurant_id = p_restaurant_id
    AND ri.deleted_at IS NULL
    AND (ri.nom_custom ILIKE '%' || p_query || '%' OR ic.nom ILIKE '%' || p_query || '%')
  
  UNION ALL
  
  -- Puis catalogue global
  SELECT
    ic.id,
    ic.nom,
    'catalog' AS source,
    ic.allergenes,
    ts_rank(ic.search_vector, plainto_tsquery('french', p_query)) AS score
  FROM ingredients_catalog ic
  WHERE ic.search_vector @@ plainto_tsquery('french', p_query)
    AND ic.id NOT IN (
      SELECT catalog_id FROM restaurant_ingredients
      WHERE restaurant_id = p_restaurant_id AND catalog_id IS NOT NULL
    )
  
  ORDER BY source DESC, score DESC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## 6. Migrations workflow

```bash
# Nouvelle migration
supabase migration new add_pms_tables

# Vérifier diff avant push
supabase db diff --linked

# Push en staging
supabase db push --db-url $STAGING_DB_URL

# En production (via CI/CD uniquement)
supabase db push --db-url $PROD_DB_URL

# Générer types TypeScript
supabase gen types typescript --linked > types/supabase.ts
```

```typescript
// types/supabase.ts (exemple partiel, généré automatiquement)
export type Database = {
  public: {
    Tables: {
      plats: {
        Row: {
          id: string
          restaurant_id: string
          nom: string
          statut: 'actif' | 'archive' | 'brouillon'
          cout_de_revient: number | null
          // ...
        }
        Insert: Omit<Database['public']['Tables']['plats']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['plats']['Insert']>
      }
      // ... autres tables
    }
  }
}
```
