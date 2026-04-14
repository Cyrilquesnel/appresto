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
