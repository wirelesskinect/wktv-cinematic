-- WKTV Custom Auth Schema
-- Run this on db.atv0.com to set up custom auth tables

-- Create wktv schema if not exists
CREATE SCHEMA IF NOT EXISTS wktv;

-- Users table (replaces Supabase Auth for this project)
CREATE TABLE IF NOT EXISTS wktv.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user', -- 'user' or 'admin'
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS wktv.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES wktv.users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON wktv.users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON wktv.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON wktv.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON wktv.sessions(expires_at);

-- Update the existing tables to reference wktv.users instead of auth.users
-- First, drop the foreign key constraints if they exist
ALTER TABLE wktv.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;
ALTER TABLE wktv.pending_matches DROP CONSTRAINT IF EXISTS pending_matches_user_id_fkey;
ALTER TABLE wktv.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- Add new foreign key constraints to wktv.users
ALTER TABLE wktv.user_subscriptions 
    ADD CONSTRAINT user_subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES wktv.users(id) ON DELETE CASCADE;

ALTER TABLE wktv.pending_matches 
    ADD CONSTRAINT pending_matches_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES wktv.users(id) ON DELETE CASCADE;

ALTER TABLE wktv.payments 
    ADD CONSTRAINT payments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES wktv.users(id) ON DELETE CASCADE;

-- Clean up expired sessions (run periodically)
-- DELETE FROM wktv.sessions WHERE expires_at < NOW();
