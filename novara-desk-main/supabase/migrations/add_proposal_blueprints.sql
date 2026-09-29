-- ============================================================================
-- Proposal Intelligence Engine — Phase 03 (Proposal Blueprint, additive)
-- ============================================================================
-- A completely new, isolated table for the "Proposal Blueprint" — the
-- structured, page-mapped, variable-resolved output that sits between
-- Proposal Intelligence (Phases 01-02) and a future Builder-population
-- phase. Linked ONLY by proposal_id — never touches, alters, or reads any
-- proposal_builder_* table (proposals/documents/variables/content
-- overrides), and is a separate table from proposal_intelligence itself
-- (that table stays Phases 01-02's concern; this one is Phase 03's own
-- record, per this phase's explicit "create a dedicated Proposal
-- Blueprint object... isolated table" instruction).
--
-- One record per proposal (UNIQUE on proposal_id) — re-generating and
-- re-saving updates the same row rather than growing a history, matching
-- "Save works / Reload works": reloading the page should show the
-- last-saved Blueprint, not a list of past runs.
--
-- `blueprint_data` is a single JSONB column (not one column per field) so
-- this object's shape can evolve across future AI phases without a
-- migration every time — the same reasoning already used for
-- proposal_intelligence.intelligence_data.
--
-- Does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage. Does NOT populate the
-- Builder or render any proposal page. Safe to run multiple times
-- (idempotent). No existing data is modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_blueprints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',

  blueprint_data  jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_blueprints_proposal
  ON proposal_blueprints (proposal_id);

ALTER TABLE proposal_blueprints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_blueprints' AND policyname = 'proposal_blueprints_staff_access'
  ) THEN
    CREATE POLICY proposal_blueprints_staff_access ON proposal_blueprints
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
