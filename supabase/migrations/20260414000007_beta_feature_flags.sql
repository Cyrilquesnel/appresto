-- Migration 000007 : Feature flags beta + paramètres globaux
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
