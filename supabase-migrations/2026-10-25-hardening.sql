-- Extra lock (defense in depth). The website talks to the database only with the
-- server's service key, so the public "anon" and "authenticated" roles never need
-- direct table access. Row-level security already blocks them; this removes access entirely.
revoke all on all tables in schema wktv from anon, authenticated;
revoke all on all sequences in schema wktv from anon, authenticated;
alter default privileges in schema wktv revoke all on tables from anon, authenticated;
alter default privileges in schema wktv revoke all on sequences from anon, authenticated;
