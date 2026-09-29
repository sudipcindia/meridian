-- ============================================================================
-- Provider identity: lets a proposal represent "Jayson Kandiah" personally
-- (the Upwork use case) instead of "Novara Consult" as the provider/brand,
-- while going through the exact same creation flow and AI generation
-- pipeline. Defaults to 'novara' for every existing row and every insert
-- that doesn't set it explicitly, so the current Novara flow is byte-for-
-- byte unchanged unless a proposal is deliberately created as 'upwork'.
-- ============================================================================

ALTER TABLE proposal_builder_proposals
  ADD COLUMN IF NOT EXISTS provider_identity text NOT NULL DEFAULT 'novara';
