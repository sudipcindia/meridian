-- ============================================================================
-- Phase 09 hardening — tighten Storage bucket RLS on the Proposal Builder's
-- private buckets.
-- ============================================================================
-- The original policies for `proposal-signatures` and `proposal-pdfs`
-- (add_proposal_client_delivery.sql, add_proposal_pdf_cache.sql) were
-- written with no `TO` clause, which defaults to PUBLIC — i.e. both the
-- `anon` and `authenticated` roles. Since the anon key ships in the built
-- client bundle, this meant anyone holding it could list/download every
-- signature PNG and PDF across every proposal directly against the
-- Supabase Storage REST API, bypass the app's own upload validation
-- entirely, and even overwrite an already-signed PDF (the `_update`
-- policy had no ownership check).
--
-- The app itself never needs anon-role access to these buckets — every
-- read/write already goes through supabaseServer (service-role key, which
-- bypasses Storage RLS regardless) or a short-lived signed URL. So these
-- policies are tightened to match the table-level pattern already
-- established in add_proposal_staff_auth.sql: `TO authenticated` plus a
-- `team_members` membership check.
-- ============================================================================

DROP POLICY IF EXISTS proposal_signatures_select ON storage.objects;
DROP POLICY IF EXISTS proposal_signatures_insert ON storage.objects;
CREATE POLICY proposal_signatures_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proposal-signatures' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
CREATE POLICY proposal_signatures_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposal-signatures' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));

DROP POLICY IF EXISTS proposal_pdfs_select ON storage.objects;
DROP POLICY IF EXISTS proposal_pdfs_insert ON storage.objects;
DROP POLICY IF EXISTS proposal_pdfs_update ON storage.objects;
CREATE POLICY proposal_pdfs_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proposal-pdfs' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
CREATE POLICY proposal_pdfs_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposal-pdfs' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
CREATE POLICY proposal_pdfs_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'proposal-pdfs' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
