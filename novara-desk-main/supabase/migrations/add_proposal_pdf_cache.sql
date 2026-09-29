-- ============================================================================
-- Proposal PDF Generation (Phase 06) — additive schema changes only
-- ============================================================================
-- One new, isolated table + one new Storage bucket, both purely a cache —
-- neither is the source of truth for a proposal's content (that remains
-- proposal_builder_documents). Keyed on (document_id, document_version),
-- which already increments by exactly 1 on every save (Phase 03) — so this
-- cache invalidates itself correctly with zero new version tracking.
--
-- Does not alter, reference, or depend on any existing Novara Desk table.
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_builder_pdfs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES proposal_builder_documents(id) ON DELETE CASCADE,
  document_version integer NOT NULL,
  storage_path     text NOT NULL,
  filename         text NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_pdfs_doc_version
  ON proposal_builder_pdfs (document_id, document_version);

ALTER TABLE proposal_builder_pdfs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_pdfs' AND policyname = 'proposal_builder_pdfs_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_pdfs_foundation_access ON proposal_builder_pdfs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ── Storage bucket — mirrors the existing profile-photos bucket pattern ─────
-- Private (not public): the app always reads it via short-lived signed URLs
-- (see api/_lib/pdf/proposalPdfAdapter.ts), matching a client-deliverable
-- document being more sensitive than a profile photo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-pdfs', 'proposal-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='proposal_pdfs_select'
  ) THEN
    CREATE POLICY proposal_pdfs_select ON storage.objects FOR SELECT USING (bucket_id = 'proposal-pdfs');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='proposal_pdfs_insert'
  ) THEN
    CREATE POLICY proposal_pdfs_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proposal-pdfs');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='proposal_pdfs_update'
  ) THEN
    CREATE POLICY proposal_pdfs_update ON storage.objects FOR UPDATE USING (bucket_id = 'proposal-pdfs');
  END IF;
END$$;

-- ============================================================================
-- OPTIONAL — staff-only hardening, to apply once the Builder has real
-- authentication (mirrors the pattern already used on the other Proposal
-- Builder tables). Rollback: drop this policy and re-create the
-- *_foundation_access one above.
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS proposal_builder_pdfs_foundation_access ON proposal_builder_pdfs;
-- CREATE POLICY proposal_builder_pdfs_staff_access ON proposal_builder_pdfs
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
-- ============================================================================
