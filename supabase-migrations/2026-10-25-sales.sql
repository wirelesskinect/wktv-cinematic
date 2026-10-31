-- Sales dashboard: remember which plan each payment was for (run once in Supabase → SQL Editor)
alter table wktv.payments add column if not exists plan_id varchar(32);
create index if not exists payments_status_created_idx on wktv.payments (status, created_at);
