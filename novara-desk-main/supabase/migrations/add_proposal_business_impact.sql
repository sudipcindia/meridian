-- ============================================================================
-- Proposal Intelligence Engine — Phase 06 (Business Impact Engine, additive)
-- ============================================================================
-- A completely new, isolated table for structured commercial calculations
-- and projections (lead growth, revenue growth, conversion improvement,
-- ROI, etc.) generated from the Proposal Blueprint's facts. Linked ONLY
-- by proposal_id — never touches, alters, or reads any proposal_builder_*
-- table, and is a separate table from proposal_intelligence,
-- proposal_blueprints, and proposal_content (each phase keeps its own
-- dedicated, isolated record).
--
-- This is intentionally a reviewable, standalone record only — there is
-- no chart/table/progress-indicator rendering capability anywhere in the
-- Proposal Builder today (verified before building this phase), so
-- nothing here is currently written into any proposal page. Builder
-- Population's "Not Yet Available" list surfaces this gap explicitly
-- rather than forcing these figures into an unrelated text field.
--
-- One record per proposal (UNIQUE on proposal_id) — re-generating and
-- re-saving updates the same row rather than growing a history.
--
-- `impact_data` is a single JSONB column so this object's shape can
-- evolve without a migration every time — the same reasoning already
-- used for intelligence_data/blueprint_data/content_data.
--
-- Does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage. Safe to run multiple times
-- (idempotent). No existing data is modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_business_impact (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL DEFAULT '',

  impact_data   jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_business_impact_proposal
  ON proposal_business_impact (proposal_id);

ALTER TABLE proposal_business_impact ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_business_impact' AND policyname = 'proposal_business_impact_staff_access'
  ) THEN
    CREATE POLICY proposal_business_impact_staff_access ON proposal_business_impact
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
