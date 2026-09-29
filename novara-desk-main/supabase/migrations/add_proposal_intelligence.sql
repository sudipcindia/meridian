-- ============================================================================
-- Proposal Intelligence Engine — Phase 01 (meeting analysis only, additive)
-- ============================================================================
-- A completely new, isolated table for the new "Proposal Intelligence
-- Engine" module, which sits BEFORE the Proposal Builder in the workflow
-- (New Proposal -> Meeting Transcript -> AI Analysis -> Proposal
-- Intelligence -> Proposal Builder). Linked ONLY by proposal_id — never
-- touches, alters, or reads any other proposal_builder_* table, and is a
-- fully separate feature from the existing proposal_builder_analyses
-- table (a different, earlier "AI Analysis" tool with its own field set
-- and its own standalone entry point at /ai-analysis — that table and
-- this one are intentionally NOT unified).
--
-- One record per proposal (UNIQUE on proposal_id) — re-analysing and
-- re-saving updates the same row rather than growing a history, matching
-- "Save works / Reload works" from the verification checklist: reloading
-- the page should show the last-saved state, not a list of past runs.
--
-- `intelligence_data` is a single JSONB column (not one column per field)
-- so this object's shape can evolve across future AI phases without a
-- migration every time — exactly the same reasoning already used for
-- proposal_builder_analyses.extracted_data/proposal_data.
--
-- Does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage. Does NOT populate the
-- Builder. Safe to run multiple times (idempotent). No existing data is
-- modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_intelligence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text NOT NULL DEFAULT '',

  transcript        text NOT NULL,
  intelligence_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_intelligence_proposal
  ON proposal_intelligence (proposal_id);

ALTER TABLE proposal_intelligence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_intelligence' AND policyname = 'proposal_intelligence_staff_access'
  ) THEN
    CREATE POLICY proposal_intelligence_staff_access ON proposal_intelligence
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
