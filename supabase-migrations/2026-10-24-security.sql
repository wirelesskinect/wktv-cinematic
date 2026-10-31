-- WKTV security + IPTV panel update (run once in Supabase → SQL Editor)

-- 1) One subscription per customer. Approvals save with "upsert on user_id",
--    which needs this unique index (without it every approval fails).
create unique index if not exists user_subscriptions_user_id_key
  on wktv.user_subscriptions (user_id);

-- 2) Failed-login / signup counter used for rate limiting
create table if not exists wktv.auth_attempts (
  id bigserial primary key,
  kind text not null,              -- 'login_fail' or 'signup'
  email text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_email_idx on wktv.auth_attempts (kind, email, created_at);
create index if not exists auth_attempts_ip_idx on wktv.auth_attempts (kind, ip, created_at);

-- Locked down like the other tables: only the server (service role) can use it
alter table wktv.auth_attempts enable row level security;
revoke all on wktv.auth_attempts from anon, authenticated;
grant select, insert, delete on wktv.auth_attempts to service_role;
grant usage, select on sequence wktv.auth_attempts_id_seq to service_role;
