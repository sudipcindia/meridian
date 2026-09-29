-- ============================================================================
-- Activate staff-only access on the Proposal Builder's internal tables
-- (Phase 08) — every earlier Proposal Builder migration shipped this exact
-- policy commented out, reserved for the moment real staff auth exists.
-- That moment is now: the Builder app gains its own Supabase Auth
-- magic-link login this phase, gated against `team_members`.
--
-- Because the Builder uses the SAME Supabase project as the main Novara
-- Desk app (index.html), a main-app user who is already logged in there
-- ALSO already satisfies these policies — no separate integration needed
-- for Ops Intel's new read-only Proposals tab.
--
-- Client-facing endpoints (api/client/*, api/proposals/send.ts, PDF
-- generation) are unaffected — they read/write exclusively through
-- supabaseServer (service-role key), which bypasses RLS entirely.
--
-- Storage bucket policies (proposal-pdfs, proposal-signatures) are
-- untouched — they are already scoped by short-lived signed URLs, not
-- table RLS.
-- ============================================================================

DROP POLICY IF EXISTS proposal_builder_foundation_access ON proposal_builder_proposals;
CREATE POLICY proposal_builder_staff_access ON proposal_builder_proposals
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_documents_foundation_access ON proposal_builder_documents;
CREATE POLICY proposal_builder_documents_staff_access ON proposal_builder_documents
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_document_versions_foundation_access ON proposal_builder_document_versions;
CREATE POLICY proposal_builder_document_versions_staff_access ON proposal_builder_document_versions
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_review_notes_foundation_access ON proposal_builder_review_notes;
CREATE POLICY proposal_builder_review_notes_staff_access ON proposal_builder_review_notes
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_pdfs_foundation_access ON proposal_builder_pdfs;
CREATE POLICY proposal_builder_pdfs_staff_access ON proposal_builder_pdfs
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_share_links_foundation_access ON proposal_builder_share_links;
CREATE POLICY proposal_builder_share_links_staff_access ON proposal_builder_share_links
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_builder_acceptances_foundation_access ON proposal_builder_acceptances;
CREATE POLICY proposal_builder_acceptances_staff_access ON proposal_builder_acceptances
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
  WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
