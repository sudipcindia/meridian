-- ============================================================================
-- Proposal Review simplification — link a proposal back to its source
-- AI Analysis, additive only
-- ============================================================================
-- One new nullable column on the EXISTING proposal_builder_proposals table:
--
--   source_analysis_id uuid — set only when a proposal was created via the
--   AI Proposal Generator's "Create Proposal in Builder" action (Phase 04),
--   referencing the proposal_builder_analyses row it came from. Nullable
--   and ON DELETE SET NULL: a proposal created the normal, manual way has
--   no source analysis, and deleting an analysis later never deletes or
--   corrupts the proposal that came from it — it just loses the link.
--
-- Used only to render a read-only "AI Analysis Summary" on the (now
-- simplified) Proposal Review page. Never affects proposal creation,
-- editing, or rendering otherwise.
--
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_proposals
  ADD COLUMN IF NOT EXISTS source_analysis_id uuid REFERENCES proposal_builder_analyses(id) ON DELETE SET NULL;
