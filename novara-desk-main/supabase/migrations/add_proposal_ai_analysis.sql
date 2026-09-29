-- ============================================================================
-- Proposal AI Analysis — Phase 01 (transcript analysis only, additive)
-- ============================================================================
-- New, fully isolated table for the AI Proposal Generator's first phase: a
-- staff member pastes a meeting transcript, Claude extracts structured
-- business information (never proposal content/HTML/Markdown/CSS), and the
-- staff member reviews/edits the result before explicitly saving it here.
--
-- Deliberately separate from every existing Proposal Builder table:
--   - Does NOT touch proposal_builder_proposals, proposal_builder_documents,
--     or any variable/content-override storage — an analysis is a standalone
--     record, not automatically linked to or merged into any proposal yet.
--   - `extracted_data` is a single JSONB column (not one column per field) —
--     the field list is still evolving with the AI Proposal Generator's next
--     phases, so this avoids a schema migration every time a new extracted
--     field is added. `client_name`/`company_name` are denormalized onto
--     their own columns purely so a future list/search view doesn't need to
--     reach into JSONB for the two fields most likely to be sorted/filtered.
--   - `transcript` stores the raw source text the analysis was generated
--     from, for traceability — never modified after insert.
--
-- Follows this schema's established proposal_builder_* naming convention and
-- staff-only RLS pattern (see add_proposal_acceptance_contact_fields.sql).
--
-- Safe to run multiple times (idempotent). No existing table is modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_builder_analyses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text NOT NULL DEFAULT '',

  transcript     text NOT NULL,

  client_name    text NOT NULL DEFAULT '',
  company_name   text NOT NULL DEFAULT '',

  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_analyses_created
  ON proposal_builder_analyses (created_at DESC);

ALTER TABLE proposal_builder_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_analyses' AND policyname = 'proposal_builder_analyses_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_analyses_staff_access ON proposal_builder_analyses
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
