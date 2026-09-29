-- ============================================================================
-- Proposal Views: raw, per-load view/session tracking (audit trail)
-- ============================================================================
-- Deliberately SEPARATE from proposal_builder_activity's existing 'viewed'
-- event (api/_lib/activity/logActivity.ts's logViewedDebounced), which
-- stays exactly as-is and continues to serve the human-readable Activity
-- tab timeline (debounced to once per 10 minutes, so a client re-opening
-- the link repeatedly doesn't spam that log with near-duplicate rows).
--
-- This table is the opposite: an UNDEBOUNCED, raw record of every real
-- page load, grouped by a client-generated session id (one browser tab
-- session, survives reloads within it) — the basis for "View & Session
-- Analytics" (Total Views, Number of Sessions, Average Time Spent, Visits
-- Before Signing) on the audit trail. duration_ms is filled in later,
-- best-effort, by a `navigator.sendBeacon` call on page unload — it can
-- legitimately stay null (backgrounded/killed tabs can miss the beacon),
-- so it must always be presented as approximate, never exact.
--
-- Staff-only RLS, matching every other proposal_builder_* table; writes go
-- through the service-role client (supabaseServer), same as every other
-- client-facing write in this app.
--
-- Safe to run multiple times (idempotent).
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_builder_views (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  session_id   text NOT NULL,
  ip_address   text,
  user_agent   text,
  geo_country  text,
  geo_region   text,
  geo_city     text,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  duration_ms  integer
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_views_proposal ON proposal_builder_views (proposal_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_builder_views_session ON proposal_builder_views (proposal_id, session_id);

ALTER TABLE proposal_builder_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'proposal_builder_views' AND policyname = 'staff_select_views'
  ) THEN
    CREATE POLICY staff_select_views ON proposal_builder_views
      FOR SELECT TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END $$;
