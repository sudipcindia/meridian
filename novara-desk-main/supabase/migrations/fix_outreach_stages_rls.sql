-- Follow-up to add_outreach_module.sql: outreach_stages was created without RLS
-- enabled (caught by the Supabase security advisor as an ERROR — a lookup
-- table is still exposed via PostgREST if RLS is off). Brings it in line with
-- the other three outreach_* tables, same auth-only convention as the rest
-- of the app (see add_standup_updates.sql).

ALTER TABLE outreach_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'outreach_stages' AND policyname = 'auth_rw_outreach_stages'
  ) THEN
    CREATE POLICY "auth_rw_outreach_stages" ON outreach_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
