-- Referrals (run once in Supabase → SQL Editor)
alter table wktv.users add column if not exists referred_by varchar(64);        -- referrer's TV username, as typed
alter table wktv.users add column if not exists referred_by_user_id uuid;      -- referrer's website account
alter table wktv.users add column if not exists referral_reward_at timestamptz; -- when the referrer got their free month
create index if not exists users_referred_by_user_idx on wktv.users (referred_by_user_id);
