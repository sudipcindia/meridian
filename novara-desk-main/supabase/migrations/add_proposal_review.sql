-- ============================================================================
-- Proposal Review & Approval (Phase 05) — additive schema changes only
-- ============================================================================
-- Two changes, both additive to the isolated Proposal Builder schema:
--
--   1. proposal_builder_proposals.status gains 4 new allowed values
--      (changes_requested, approved, rejected, ready_for_pdf) — the existing
--      values (draft, internal_review, ready, sent, signed, archived) are
--      unchanged, so no existing row or existing UI filter breaks.
--
--   2. A new, isolated proposal_builder_review_notes table — an append-only
--      log of reviewer comments. Notes are never overwritten: resolving a
--      note only flips its `resolved` flag, the original reviewer/comment/
--      timestamp stay intact forever. Status changes are also logged here
--      as system-generated notes (see src/lib/reviews.ts), giving "status
--      changes must be tracked" and "do not overwrite previous notes" the
--      same single, simple mechanism rather than two separate systems.
--
-- Does not alter, reference, or depend on any existing Novara Desk table.
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_proposals DROP CONSTRAINT IF EXISTS proposal_builder_proposals_status_check;
ALTER TABLE proposal_builder_proposals ADD CONSTRAINT proposal_builder_proposals_status_check
  CHECK (status IN (
    'draft', 'internal_review', 'changes_requested', 'approved', 'rejected',
    'ready_for_pdf', 'ready', 'sent', 'signed', 'archived'
  ));

CREATE TABLE IF NOT EXISTS proposal_builder_review_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  -- No staff-auth system exists yet (same gap already noted on the other
  -- Proposal Builder tables) — reviewer is a free-text name for now.
  reviewer     text NOT NULL DEFAULT '',
  comment      text NOT NULL,
  resolved     boolean NOT NULL DEFAULT false,

  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_review_notes_proposal
  ON proposal_builder_review_notes (proposal_id, created_at DESC);

-- ── RLS — permissive for now, matching the existing Proposal Builder tables ──
ALTER TABLE proposal_builder_review_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_review_notes' AND policyname = 'proposal_builder_review_notes_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_review_notes_foundation_access ON proposal_builder_review_notes
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================================
-- OPTIONAL — staff-only hardening, to apply once the Builder has real
-- authentication (mirrors the pattern already used on the other Proposal
-- Builder tables). Rollback: drop this policy and re-create the
-- *_foundation_access one above.
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS proposal_builder_review_notes_foundation_access ON proposal_builder_review_notes;
-- CREATE POLICY proposal_builder_review_notes_staff_access ON proposal_builder_review_notes
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
-- ============================================================================
