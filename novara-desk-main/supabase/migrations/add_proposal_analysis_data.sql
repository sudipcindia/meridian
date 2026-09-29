-- ============================================================================
-- Proposal AI Analysis — Phase 03 (Proposal Data synthesis, additive)
-- ============================================================================
-- Extends the EXISTING proposal_builder_analyses table (Phase 01/02) with
-- one new column:
--
--   proposal_data jsonb — a clean, structured "Proposal Data" object
--   (clientName, companyName, website, industry, location, painPoints,
--   goals, services, pricing, recommendation, cta, summary) synthesised by
--   Claude from the saved transcript + extracted analysis + follow-up
--   answers. This is DATA ONLY — no proposal pages, no HTML, no Markdown,
--   no CSS, and it is never written to or read by the Proposal Builder
--   (proposal_builder_proposals/documents/variables). Whether/how a later
--   phase feeds this into an actual proposal is an explicit future
--   decision, not made by this migration.
--
-- Kept on the same analysis row (not a new table) for the same reason
-- follow_up_answers was: it's generated FROM and tightly scoped to one
-- specific saved analysis, not an independent record of its own.
--
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_analyses
  ADD COLUMN IF NOT EXISTS proposal_data jsonb NOT NULL DEFAULT '{}'::jsonb;
