-- ============================================================================
-- Client Portal V1 — schema additions
-- ============================================================================
-- Adds the two tables the portal needs. Tickets, plans, promises, comments and
-- team records are REUSED from existing tables (no duplication). Client-facing
-- notifications reuse the existing `notifications` table (user_email = client
-- login email).
--
-- Security note: all client data access goes through the /api/portal/* proxy
-- using the service-role key. The optional RLS hardening that closes the public
-- anon-key hole lives at the BOTTOM of this file, fenced and commented — apply
-- it only after the regression checks in the plan pass.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- client_portal_users — login credentials for client-portal access
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_portal_users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email                text NOT NULL,
  password_hash        text,                       -- format: scrypt$<saltHex>$<hashHex>
  status               text NOT NULL DEFAULT 'active',   -- active | disabled
  must_change_password boolean NOT NULL DEFAULT true,
  setup_token          text,                       -- one-time token for first password set
  setup_expires_at     timestamptz,
  last_login_at        timestamptz,
  created_by           text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- One login email globally; lower() so matching is case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cpu_email ON client_portal_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_cpu_client ON client_portal_users (client_id);

-- ----------------------------------------------------------------------------
-- meetings — client meeting hub (book / notes / recordings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  scheduled_at  timestamptz,
  duration_min  integer DEFAULT 30,
  meeting_url   text,
  status        text NOT NULL DEFAULT 'upcoming',  -- upcoming | completed | cancelled
  notes         text,
  recording_url text,
  requested_by  text,                              -- 'client' when booked from portal
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_client_time ON meetings (client_id, scheduled_at DESC);

-- ============================================================================
-- OPTIONAL — Phase 4 RLS hardening. Closes the public anon-key read hole so the
-- portal's isolation guarantee is real. The service role (proxy + edge funcs)
-- BYPASSES RLS, so nothing server-side breaks. Staff keep full access because
-- their auth email is present in team_members.
--
-- APPLY ONLY AFTER verifying the internal app + realtime + daily-briefing still
-- work in staging. Rollback for any table: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
-- ----------------------------------------------------------------------------
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['clients','tickets','performance_plans','team_members','notifications']
--   LOOP
--     EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
--     EXECUTE format('DROP POLICY IF EXISTS staff_full_access ON %I', t);
--     EXECUTE format($f$
--       CREATE POLICY staff_full_access ON %I
--       FOR ALL TO authenticated
--       USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--       WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--     $f$, t);
--   END LOOP;
-- END $$;
-- ============================================================================
