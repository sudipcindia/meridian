-- ============================================================================
-- Proposal AI Analysis — Phase 02 (missing-information follow-ups, additive)
-- ============================================================================
-- Extends the EXISTING proposal_builder_analyses table (added in
-- add_proposal_ai_analysis.sql, Phase 01) with one new column:
--
--   follow_up_answers jsonb — staff answers to the follow-up questions
--   Claude generates after inspecting a saved analysis (Budget, Target
--   Location, Target Audience, Revenue Goal, Monthly Marketing Budget,
--   Current CRM, Current Website Platform, Main Competitor, Business
--   Priority). Kept in its own column, separate from `extracted_data`
--   (Phase 01's fixed TranscriptAnalysisFields shape), so this phase never
--   has to widen or redefine that existing type.
--
-- Still does NOT touch proposal_builder_proposals, proposal_builder_documents,
-- or any variable/content-override storage — an analysis remains a
-- standalone record. Answering follow-ups UPDATES the same analysis row
-- (never creates a new one, never generates proposal content).
--
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_analyses
  ADD COLUMN IF NOT EXISTS follow_up_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
