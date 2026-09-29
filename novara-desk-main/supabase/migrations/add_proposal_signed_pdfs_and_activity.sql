-- ============================================================================
-- Phase 08 — Signed PDF artifacts + the Activity Timeline / Audit Trail
-- ============================================================================
-- Two additions, both additive:
--
--   1. proposal_builder_signed_pdfs — the final, signature-stamped PDF
--      generated once a client accepts. Kept as its OWN table (not a column
--      on proposal_builder_pdfs, Phase 06) so that table's existing
--      draft-PDF cache/query code needs zero changes. Reuses the same
--      `proposal-pdfs` Storage bucket under a `signed/` path prefix — no
--      new bucket.
--
--   2. proposal_builder_activity — one append-only table serving BOTH the
--      brief's "Activity Timeline" and "Audit Trail" sections (they
--      describe the same need: timestamp + user/system + action, never
--      overwritten). `action` is free text, not an enum, so future event
--      types never require a migration.
--
--   3. proposal_builder_proposals gains `first_viewed_at` — set once, the
--      first time a client opens their link. Used only to derive a
--      "Viewed" display state on top of the existing `sent` status; the
--      real ProposalStatus enum and its gating logic (SENDABLE_STATUSES /
--      ALLOWED_STATUSES / VIEWABLE_STATUSES) are untouched.
--
-- Both new tables get staff-only RLS directly (no permissive interim
-- period needed — Phase 08 activates staff auth in the same release).
-- Client-facing writes (api/client/accept.ts, api/client/resolve.ts) use
-- supabaseServer (service-role key), which bypasses RLS regardless.
-- ============================================================================

ALTER TABLE proposal_builder_proposals ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

CREATE TABLE IF NOT EXISTS proposal_builder_signed_pdfs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  document_id       uuid NOT NULL REFERENCES proposal_builder_documents(id) ON DELETE CASCADE,
  document_version  integer NOT NULL,
  acceptance_id     uuid NOT NULL REFERENCES proposal_builder_acceptances(id) ON DELETE CASCADE,

  storage_path      text NOT NULL,
  filename          text NOT NULL,
  generated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_signed_pdfs_acceptance
  ON proposal_builder_signed_pdfs (acceptance_id);

CREATE TABLE IF NOT EXISTS proposal_builder_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  action       text NOT NULL,
  actor        text NOT NULL,       -- staff email, 'client', or 'system'
  actor_name   text,
  detail       text,

  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_activity_proposal
  ON proposal_builder_activity (proposal_id, created_at DESC);

ALTER TABLE proposal_builder_signed_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_activity ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_signed_pdfs' AND policyname = 'proposal_builder_signed_pdfs_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_signed_pdfs_staff_access ON proposal_builder_signed_pdfs
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_activity' AND policyname = 'proposal_builder_activity_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_activity_staff_access ON proposal_builder_activity
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
