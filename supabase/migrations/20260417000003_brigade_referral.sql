CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parrain_restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  code TEXT NOT NULL UNIQUE,        -- BRIGADE-MARIE
  filleul_email TEXT,
  filleul_restaurant_id UUID REFERENCES restaurants(id),
  statut TEXT NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending', 'registered', 'converted', 'credited')),
  stripe_coupon_parrain TEXT,       -- coupon Stripe créé pour le parrain
  stripe_coupon_filleul TEXT,       -- coupon Stripe créé pour le filleul
  converted_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_code ON referrals(code);
CREATE INDEX idx_referrals_parrain ON referrals(parrain_restaurant_id);

-- RLS : chaque restaurant voit ses propres referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurants_own_referrals" ON referrals
  FOR ALL USING (parrain_restaurant_id = (
    SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid() LIMIT 1
  ));
