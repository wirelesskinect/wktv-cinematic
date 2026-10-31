-- Reseller inquiries from the "Become a reseller" form on the homepage
-- (run once in Supabase → SQL Editor). Safe to run more than once.

create table if not exists wktv.reseller_inquiries (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'approved', 'declined')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reseller_inquiries_created_idx on wktv.reseller_inquiries (created_at desc);
create index if not exists reseller_inquiries_status_idx on wktv.reseller_inquiries (status, created_at desc);

-- Locked down like the other tables: only the server (service role) can read or write it.
-- Sending an inquiry never gives anyone reseller access or panel credits.
alter table wktv.reseller_inquiries enable row level security;
revoke all on wktv.reseller_inquiries from anon, authenticated;
grant select, insert, update on wktv.reseller_inquiries to service_role;
