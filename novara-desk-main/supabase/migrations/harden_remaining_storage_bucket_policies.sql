-- Fix (found during 2026-09-15 technical QA, same sweep as
-- harden_ticket_attachments_storage_policies.sql): a full audit of every
-- storage.objects policy turned up the identical "no TO clause -> defaults
-- to PUBLIC (anon key included)" mistake on three more buckets, plus one
-- bucket where the fix for it was already written (add_proposal_storage_
-- hardening.sql) but never actually took effect in production — the old
-- public-role policies it was supposed to DROP are still live today,
-- alongside no trace of the new staff-scoped ones it tried to CREATE.
--
-- 1) profile-photos: write ops used only from index.html (staff, always
--    authenticated) — no legitimate anon/public write path exists.
-- 2) report-uploads: write ops used only from index.html (staff uploading
--    client reports) — public SELECT is correct and left alone (clients
--    view reports via public URL from the Client Portal), write is not.
-- 3) resume-uploads: upload()/getPublicUrl() are both called from
--    index.html (the internal ATS "Hiring" tab) — this was never a public
--    candidate-facing form, so {anon} was simply the wrong role, not an
--    intentional design.
-- 4) proposal-signatures: re-running the exact DROP+CREATE the prior
--    hardening migration already specified, since the old public policies
--    it targeted are still present.
DROP POLICY IF EXISTS profile_photos_insert ON storage.objects;
DROP POLICY IF EXISTS profile_photos_update ON storage.objects;
DROP POLICY IF EXISTS profile_photos_delete ON storage.objects;
CREATE POLICY profile_photos_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');
CREATE POLICY profile_photos_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos');
CREATE POLICY profile_photos_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS report_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS report_uploads_update ON storage.objects;
DROP POLICY IF EXISTS report_uploads_delete ON storage.objects;
CREATE POLICY report_uploads_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-uploads');
CREATE POLICY report_uploads_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'report-uploads');

DROP POLICY IF EXISTS allow_anon_upload_resume ON storage.objects;
DROP POLICY IF EXISTS allow_anon_select_resume ON storage.objects;
DROP POLICY IF EXISTS allow_anon_delete_resume ON storage.objects;
CREATE POLICY allow_staff_upload_resume ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resume-uploads');
CREATE POLICY allow_staff_select_resume ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'resume-uploads');
CREATE POLICY allow_staff_delete_resume ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'resume-uploads');

DROP POLICY IF EXISTS proposal_signatures_select ON storage.objects;
DROP POLICY IF EXISTS proposal_signatures_insert ON storage.objects;
CREATE POLICY proposal_signatures_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proposal-signatures' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
CREATE POLICY proposal_signatures_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposal-signatures' AND auth.jwt()->>'email' IN (SELECT email FROM team_members));
