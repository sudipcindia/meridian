-- ============================================================================
-- Proposal Intelligence Engine — Phase 05 (Sales Content Engine, additive)
-- ============================================================================
-- A completely new, isolated table for the "Sales Content Engine" — the
-- persuasive, page-mapped proposal COPY generated from the Proposal
-- Blueprint's structured facts (Phase 03), one step before Builder
-- Population (Phase 04's screen now prefers this content when present,
-- falling back to the Blueprint's own page content otherwise). Linked
-- ONLY by proposal_id — never touches, alters, or reads any
-- proposal_builder_* table, and is a separate table from both
-- proposal_intelligence and proposal_blueprints (each phase keeps its own
-- dedicated, isolated record).
--
-- One record per proposal (UNIQUE on proposal_id) — re-generating and
-- re-saving updates the same row rather than growing a history, matching
-- "Save works / Reload works".
--
-- `content_data` is a single JSONB column (not one column per field) so
-- this object's shape can evolve without a migration every time — the
-- same reasoning already used for intelligence_data/blueprint_data.
--
-- Does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage directly — Builder Population
-- (a separate, explicit user action) is still the only thing that ever
-- writes into the Builder's own document. Safe to run multiple times
-- (idempotent). No existing data is modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_content (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL DEFAULT '',

  content_data  jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_content_proposal
  ON proposal_content (proposal_id);

ALTER TABLE proposal_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_content' AND policyname = 'proposal_content_staff_access'
  ) THEN
    CREATE POLICY proposal_content_staff_access ON proposal_content
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
