-- User subscriptions table (with region support)
-- Add region column if not exists (run this on existing tables)
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'TN';

-- Full schema for new setup:
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    iptv_username VARCHAR(255),
    iptv_password VARCHAR(255),
    plan_name VARCHAR(100) DEFAULT '1 Month',
    price_cents INTEGER DEFAULT 2500,
    status VARCHAR(50) DEFAULT 'pending_match',
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT false,
    blockchyp_token VARCHAR(255),
    region VARCHAR(10) DEFAULT 'TN', -- TN = Tennessee, KY = Kentucky
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending matches (for manual review)
ALTER TABLE pending_matches ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'TN';

CREATE TABLE IF NOT EXISTS pending_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name VARCHAR(255),
    user_phone VARCHAR(50),
    user_email VARCHAR(255),
    matched_iptv_username VARCHAR(255),
    match_confidence FLOAT,
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    region VARCHAR(10) DEFAULT 'TN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history
ALTER TABLE payments ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'TN';

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id),
    amount_cents INTEGER NOT NULL,
    blockchyp_transaction_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    region VARCHAR(10) DEFAULT 'TN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own data
DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own matches" ON pending_matches;
CREATE POLICY "Users can view own matches" ON pending_matches
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for API routes)
DROP POLICY IF EXISTS "Service role full access subscriptions" ON user_subscriptions;
CREATE POLICY "Service role full access subscriptions" ON user_subscriptions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access matches" ON pending_matches;
CREATE POLICY "Service role full access matches" ON pending_matches
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access payments" ON payments;
CREATE POLICY "Service role full access payments" ON payments
    FOR ALL USING (true);

-- Index for region queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_region ON user_subscriptions(region);
CREATE INDEX IF NOT EXISTS idx_payments_region ON payments(region);
CREATE INDEX IF NOT EXISTS idx_matches_region ON pending_matches(region);
