-- ============================================================================
-- Proposal System — Production Hardening Pass (additive/optimisation only)
-- ============================================================================
-- No existing Proposal data is changed by this migration. Everything below
-- is either (a) an index addition — pure read-performance, no behavior
-- change, or (b) an RLS policy tightening that was already anticipated and
-- pre-written (commented out, ready to apply) by the migrations that
-- created these tables, closing the anon-key gap left when staff auth was
-- rolled out in add_proposal_staff_auth.sql for six sibling tables but not
-- these three. Safe to run multiple times (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tighten the three tables left on the original permissive
--    `FOR ALL USING (true)` policy from before staff auth existed. Every
--    other proposal_builder_* table was already hardened to staff-only in
--    add_proposal_staff_auth.sql — these three were deliberately left as
--    "OPTIONAL" follow-ups in their own creation migrations
--    (add_proposal_editor.sql, add_proposal_pdf_cache.sql,
--    add_proposal_review.sql), which is now being applied. All access to
--    these tables already goes through requireStaffAuth-gated server
--    routes or the staff-authenticated Builder UI, so this only closes an
--    anon-key gap — nothing in the app's own behavior changes.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS proposal_builder_document_versions_foundation_access ON proposal_builder_document_versions;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_document_versions' AND policyname = 'proposal_builder_document_versions_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_document_versions_staff_access ON proposal_builder_document_versions
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;

DROP POLICY IF EXISTS proposal_builder_pdfs_foundation_access ON proposal_builder_pdfs;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_pdfs' AND policyname = 'proposal_builder_pdfs_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_pdfs_staff_access ON proposal_builder_pdfs
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;

DROP POLICY IF EXISTS proposal_builder_review_notes_foundation_access ON proposal_builder_review_notes;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_review_notes' AND policyname = 'proposal_builder_review_notes_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_review_notes_staff_access ON proposal_builder_review_notes
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. Missing indexes on foreign-key / lookup columns. Every proposal_id
--    column on a table that could grow beyond ~1 row per proposal was
--    already indexed except these — the rest (proposal_intelligence,
--    proposal_blueprints, etc.) are already covered by their own unique
--    index, since they're strictly 1 row per proposal.
-- ----------------------------------------------------------------------------

-- Grows with every bug/blocker logged per proposal — the one real gap: no
-- index at all on the column every "show issues for this proposal" query
-- filters on.
CREATE INDEX IF NOT EXISTS idx_proposal_builder_issues_proposal
  ON proposal_builder_issues (proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_signed_pdfs_proposal
  ON proposal_builder_signed_pdfs (proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_signed_pdfs_document
  ON proposal_builder_signed_pdfs (document_id);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_acceptances_document
  ON proposal_builder_acceptances (document_id);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_proposals_duplicated_from
  ON proposal_builder_proposals (duplicated_from);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_proposals_source_analysis
  ON proposal_builder_proposals (source_analysis_id);

-- ----------------------------------------------------------------------------
-- 3. Redundant index removal. `proposal_builder_acceptances` can only ever
--    have one row per proposal (enforced by
--    uniq_proposal_builder_acceptances_proposal, added in
--    add_proposal_acceptance_contact_fields.sql) — the older composite
--    index's `accepted_at DESC` ordering component is dead weight once
--    that unique, single-column index exists and covers every by-proposal
--    lookup this table will ever need. Pure write-overhead reduction, no
--    read path depends on the dropped index (confirmed: nothing in this
--    codebase queries proposal_builder_acceptances ordered by accepted_at
--    across multiple rows for the same proposal, since there is never more
--    than one).
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_proposal_builder_acceptances_proposal;
