-- ============================================================================
-- Proposal Intelligence Engine — Phase 02 (Smart Follow-up Questions)
-- ============================================================================
-- Reuses the existing proposal_intelligence record from Phase 01 — no new
-- table. Question generation, in-progress answers, and completion state
-- all live in one extra JSONB column on the same row (one per proposal),
-- so "Save Progress" and "Reload works" just read/write this column
-- alongside the existing intelligence_data. Never a separate history of
-- question runs, matching the same one-row-per-proposal contract as
-- intelligence_data itself.
--
-- Does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage. Does NOT create a new table.
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_intelligence
  ADD COLUMN IF NOT EXISTS questions_progress jsonb NOT NULL DEFAULT '{}'::jsonb;
