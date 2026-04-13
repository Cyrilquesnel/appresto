# Task 1.2: Supabase Setup + Migrations Schéma Complet

## Objective
Initialiser Supabase en local (CLI), appliquer toutes les migrations SQL du schéma complet (tables, RLS, triggers, Edge Function), et générer les types TypeScript. C'est la fondation de toutes les données du projet.

## Context
Toutes les tables sont créées ici dès le début — même celles des modules futurs. Le multi-tenant est natif dès J1 via `restaurant_id`. RLS activé sur toutes les tables sans exception.

## Dependencies
- Task 1.1 — projet Next.js initialisé, dossier `supabase/` créé

## Blocked By
- Task 1.1

## Implementation Plan

### Step 1: Installer et initialiser Supabase CLI

```bash
npm install -g supabase
cd "/Users/cyril/APP RESTO"
supabase init
supabase start  # Lance PostgreSQL local sur port 54322, API sur 54321
```

Copier les valeurs affichées dans `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key affiché>
SUPABASE_SERVICE_ROLE_KEY=<service_role key affiché>
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Step 2: Créer les clients Supabase Next.js

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: any) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: any) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Step 3: Migration 1 — Schéma initial (tables core + OPÉRER + ACHETER + PILOTER)

```bash
supabase migration new initial_schema
```

Écrire dans `supabase/migrations/TIMESTAMP_initial_schema.sql` :

```sql
-- Extension pg_net pour triggers async
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ══════════════════════════════════════════════
-- CORE : Multi-tenant
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
-- CATALOGUE INGRÉDIENTS
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
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('french', nom || ' ' || COALESCE(categorie, ''))) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingredients_catalog_search ON ingredients_catalog USING GIN (search_vector);

CREATE TABLE restaurant_ingredients (
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

CREATE VIEW ingredients_view AS
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

CREATE TABLE plats (
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

CREATE TABLE fiche_technique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plat_id UUID REFERENCES plats(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES restaurant_ingredients(id),
  grammage DECIMAL(8,2) NOT NULL,
  unite TEXT DEFAULT 'g',
  ordre INTEGER DEFAULT 0,
  fournisseur_id_habituel UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  etapes JSONB DEFAULT '[]',
  temps_prep_total INTEGER,
  materiel JSONB DEFAULT '[]',
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
  envoye_via TEXT,
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
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, external_id, source)
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
  mois DATE NOT NULL,
  montant_brut DECIMAL(10,2) NOT NULL,
  nb_employes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, mois)
);

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

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- EVENT LOG
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

### Step 4: Migration 2 — Tables PMS

```bash
supabase migration new pms_tables
```

```sql
-- supabase/migrations/TIMESTAMP_pms_tables.sql

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
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- JAMAIS de UPDATE ni DELETE sur cette table
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

-- Subscriptions Stripe (pour phase commercialisation — table vide en beta)
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
```

### Step 5: Migration 3 — Politiques RLS

```bash
supabase migration new rls_policies
```

```sql
-- Fonction helper
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Pattern RLS pour chaque table (répéter pour toutes)
-- Activer RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
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

-- Politiques pour PLATS (pattern à répliquer sur toutes les tables avec restaurant_id)
CREATE POLICY "plats_select" ON plats FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_insert" ON plats FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_update" ON plats FOR UPDATE USING (restaurant_id = get_user_restaurant_id()) WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_delete" ON plats FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- Répliquer le même pattern pour : fournisseurs, mercuriale, bons_de_commande, ventes, charges, masse_salariale, equipements, nettoyage_checklists, receptions, haccp_points_critiques, rappel_alerts, formations_hygiene, subscriptions, events, inventaire_reel, push_subscriptions, restaurant_ingredients

-- TEMPÉRATURE LOGS : INSERT SEULEMENT (immuabilité légale)
CREATE POLICY "temp_logs_select" ON temperature_logs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "temp_logs_insert" ON temperature_logs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- NETTOYAGE COMPLETIONS : INSERT SEULEMENT
CREATE POLICY "nettoyage_completions_select" ON nettoyage_completions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "nettoyage_completions_insert" ON nettoyage_completions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- RESTAURANTS (owner uniquement)
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT USING (owner_id = auth.uid() OR id = get_user_restaurant_id());
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE USING (owner_id = auth.uid());

-- RESTAURANT_USERS
CREATE POLICY "restaurant_users_select" ON restaurant_users FOR SELECT USING (user_id = auth.uid() OR restaurant_id = get_user_restaurant_id());
CREATE POLICY "restaurant_users_insert" ON restaurant_users FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id() OR user_id = auth.uid());

-- INGREDIENTS CATALOG (lecture publique)
ALTER TABLE ingredients_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_select" ON ingredients_catalog FOR SELECT TO authenticated USING (true);

-- Fiche technique (via plat restaurant)
CREATE POLICY "fiche_technique_select" ON fiche_technique FOR SELECT USING (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "fiche_technique_insert" ON fiche_technique FOR INSERT WITH CHECK (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "fiche_technique_update" ON fiche_technique FOR UPDATE USING (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "fiche_technique_delete" ON fiche_technique FOR DELETE USING (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);

-- Versions fiches (SELECT + INSERT seulement)
CREATE POLICY "fiche_versions_select" ON fiche_technique_versions FOR SELECT USING (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "fiche_versions_insert" ON fiche_technique_versions FOR INSERT WITH CHECK (
  plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id())
);

-- Bon lignes (via bon restaurant)
CREATE POLICY "bon_lignes_select" ON bon_de_commande_lignes FOR SELECT USING (
  bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "bon_lignes_insert" ON bon_de_commande_lignes FOR INSERT WITH CHECK (
  bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "bon_lignes_update" ON bon_de_commande_lignes FOR UPDATE USING (
  bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "bon_lignes_delete" ON bon_de_commande_lignes FOR DELETE USING (
  bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id())
);

-- Reception items (via reception restaurant)
CREATE POLICY "reception_items_select" ON reception_items FOR SELECT USING (
  reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id())
);
CREATE POLICY "reception_items_insert" ON reception_items FOR INSERT WITH CHECK (
  reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id())
);
```

### Step 6: Migration 4 — Trigger cascade + Fonctions

```bash
supabase migration new triggers_and_functions
```

```sql
-- Trigger cascade prix → coûts (async via pg_net)
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url', true) || '/recalculate-costs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la transaction principale
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
```

### Step 7: Edge Function recalculate-costs

```typescript
// supabase/functions/recalculate-costs/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { ingredient_id, nouveau_prix } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: lignes } = await supabase
    .from('fiche_technique')
    .select('plat_id, grammage, unite')
    .eq('ingredient_id', ingredient_id)

  if (!lignes?.length) return new Response(JSON.stringify({ updated: 0 }))

  const platIds = [...new Set(lignes.map((l: any) => l.plat_id))]

  for (const platId of platIds) {
    const { data: allLignes } = await supabase
      .from('fiche_technique')
      .select('grammage, ingredient_id, mercuriale!inner(prix)')
      .eq('plat_id', platId)

    const cout = allLignes?.reduce((sum: number, l: any) => {
      const prix = l.mercuriale?.[0]?.prix ?? 0
      return sum + (l.grammage / 1000) * prix
    }, 0) ?? 0

    await supabase.from('plats')
      .update({ cout_de_revient: cout, updated_at: new Date().toISOString() })
      .eq('id', platId)

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

### Step 8: Seed initial

```sql
-- supabase/seed.sql
-- Ingrédients de test pour développement
INSERT INTO ingredients_catalog (nom, categorie, allergenes, kcal_par_100g, unite_standard) VALUES
('Boeuf haché', 'viande', '{}', 250, 'g'),
('Poulet filet', 'viande', '{}', 165, 'g'),
('Saumon filet', 'poisson', '{"poisson"}', 208, 'g'),
('Beurre doux', 'laitage', '{"lait"}', 717, 'g'),
('Crème fraîche', 'laitage', '{"lait"}', 300, 'ml'),
('Farine T55', 'féculent', '{"gluten"}', 364, 'g'),
('Tomate', 'légume', '{}', 18, 'g'),
('Oignon', 'légume', '{}', 40, 'g'),
('Ail', 'légume', '{}', 149, 'g'),
('Pomme de terre', 'légume', '{}', 77, 'g'),
('Riz basmati', 'féculent', '{}', 350, 'g'),
('Pâtes tagliatelles', 'féculent', '{"gluten","oeufs"}', 352, 'g'),
('Parmesan', 'fromage', '{"lait"}', 431, 'g'),
('Emmental', 'fromage', '{"lait"}', 380, 'g'),
('Lait entier', 'laitage', '{"lait"}', 65, 'ml'),
('Oeuf entier', 'autre', '{"oeufs"}', 143, 'piece'),
('Huile d''olive', 'autre', '{}', 884, 'ml'),
('Sel', 'épice', '{}', 0, 'g'),
('Poivre noir', 'épice', '{}', 251, 'g'),
('Champignon de Paris', 'légume', '{}', 22, 'g');
```

### Step 9: Générer types TypeScript

```bash
supabase gen types typescript --local > types/supabase.ts
```

Créer `types/supabase.ts` si la commande échoue (schema pas encore migré) :
```typescript
// types/supabase.ts — sera régénéré après migrations
export type Database = {
  public: {
    Tables: Record<string, any>
    Views: Record<string, any>
    Functions: Record<string, any>
  }
}
```

### Step 10: Appliquer migrations + seed

```bash
supabase db reset  # reset + apply all migrations + seed
```

## Files to Create

- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `supabase/migrations/TIMESTAMP_initial_schema.sql`
- `supabase/migrations/TIMESTAMP_pms_tables.sql`
- `supabase/migrations/TIMESTAMP_rls_policies.sql`
- `supabase/migrations/TIMESTAMP_triggers_and_functions.sql`
- `supabase/functions/recalculate-costs/index.ts`
- `supabase/seed.sql`
- `types/supabase.ts`
- `.env.local`

## Contracts

### Provides (pour tâches suivantes)
- `createClient()` (server) et `createClient()` (browser) — clients Supabase typés
- `createServiceClient()` — client service role pour Edge Functions
- Toutes les tables créées et accessibles
- RLS active sur toutes les tables
- Fonction `get_user_restaurant_id()` disponible
- Fonction `search_ingredients()` disponible
- Trigger `after_mercuriale_update` actif
- `types/supabase.ts` — types TypeScript générés

## Acceptance Criteria

- [ ] `supabase start` démarre sans erreurs
- [ ] `supabase db reset` applique toutes les migrations et le seed sans erreur
- [ ] `supabase gen types typescript --local > types/supabase.ts` produit un fichier valide
- [ ] `npm run typecheck` passe avec les types générés
- [ ] Test RLS : 2 users, 2 restaurants — user A ne voit pas les données de user B
- [ ] `temperature_logs` : INSERT ok, UPDATE → interdit, DELETE → interdit
- [ ] 20 ingrédients dans `ingredients_catalog` après seed

## Testing Protocol

### SQL Tests
```sql
-- Vérifier comptes tables
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Attendu : 25+ tables

-- Test seed
SELECT count(*) FROM ingredients_catalog;
-- Attendu : 20

-- Test RLS temperature_logs immuable
-- (Faire dans Supabase Studio avec un user authentifié)
INSERT INTO temperature_logs (equipement_id, restaurant_id, valeur) VALUES (...);  -- OK
UPDATE temperature_logs SET valeur = 5 WHERE id = '...';  -- Doit échouer

-- Test search_ingredients
SELECT * FROM search_ingredients('beurre', null, 5);
-- Attendu : au moins 1 résultat
```

### pgTAP (créer plus tard en Task 7.4)
Test de base à inclure dans `supabase/tests/rls_isolation.test.sql`

### Build/Lint/Type Checks
- [ ] `npm run typecheck` passe

## Skills to Read

- `supabase-rls-multitenant` — schéma complet, patterns RLS, triggers
- `mise-en-place-architecture` — règles non-négociables

## Research Files to Read

- `.claude/orchestration-mise-en-place/research/database-multitenant-rls.md` — schéma SQL complet

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.2:`

## PROGRESS.md Update

Marquer Task 1.2 ✅ dans PROGRESS.md. Noter le nombre de tables créées.
