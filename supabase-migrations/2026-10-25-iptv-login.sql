-- Customers choose their IPTV app login at checkout (run once in Supabase → SQL Editor,
-- BEFORE merging the code that uses it)
alter table wktv.pending_signups add column if not exists requested_username varchar(32);
alter table wktv.pending_signups add column if not exists requested_password varchar(64);
create index if not exists pending_signups_requested_username_idx on wktv.pending_signups (requested_username);
create index if not exists user_subscriptions_iptv_username_idx on wktv.user_subscriptions (iptv_username);
