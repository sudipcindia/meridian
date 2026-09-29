-- ============================================================================
-- Proposal Editor (Phase 03) — additive schema changes only
-- ============================================================================
-- Two changes, both additive to the isolated Proposal Builder schema:
--
--   1. proposal_builder_documents gains `content_overrides` — free-text
--      edits for generic content blocks (paragraphs/headings), separate
--      from the existing `variables` column (bracket-placeholder values).
--
--   2. A new, isolated `proposal_builder_document_versions` table — an
--      append-only log created once per save, storing a full snapshot
--      (not a diff) so a future phase can restore from it without replay
--      logic. `document_version` is REUSED from proposal_builder_documents
--      (it already increments once per save) rather than a new counter.
--
-- Does not alter, reference, or depend on any existing Novara Desk table.
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_documents
  ADD COLUMN IF NOT EXISTS content_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS proposal_builder_document_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES proposal_builder_documents(id) ON DELETE CASCADE,

  -- Copy of proposal_builder_documents.document_version at save time —
  -- reused as-is, not a separate counter (see header comment).
  document_version   integer NOT NULL,

  variables          jsonb NOT NULL,
  content_overrides  jsonb NOT NULL,

  -- No staff-auth system exists yet (same gap already noted on the two
  -- existing Proposal Builder tables) — placeholder free-text for now.
  edited_by          text NOT NULL DEFAULT '',
  summary            text NOT NULL DEFAULT '',

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_document_versions_doc_version
  ON proposal_builder_document_versions (document_id, document_version);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_document_versions_document
  ON proposal_builder_document_versions (document_id, created_at DESC);

-- ── RLS — permissive for now, matching the existing two tables' pattern ────
ALTER TABLE proposal_builder_document_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_document_versions' AND policyname = 'proposal_builder_document_versions_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_document_versions_foundation_access ON proposal_builder_document_versions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================================
-- OPTIONAL — staff-only hardening, to apply once the Builder has real
-- authentication (mirrors the pattern already used on the other two
-- Proposal Builder tables). Rollback: drop this policy and re-create the
-- *_foundation_access one above.
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS proposal_builder_document_versions_foundation_access ON proposal_builder_document_versions;
-- CREATE POLICY proposal_builder_document_versions_staff_access ON proposal_builder_document_versions
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
-- ============================================================================
