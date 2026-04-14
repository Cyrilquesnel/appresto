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
