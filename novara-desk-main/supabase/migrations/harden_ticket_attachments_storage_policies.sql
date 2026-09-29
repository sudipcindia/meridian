-- Fix (found during 2026-09-15 technical QA): create_ticket_attachments_bucket.sql
-- created its INSERT/UPDATE/DELETE policies with no `TO` clause, which
-- defaults to the PUBLIC pseudo-role — i.e. both `anon` and `authenticated`.
-- Since the anon key ships in the built client bundle (readable by anyone),
-- this meant any unauthenticated internet user could upload, overwrite, or
-- delete any object in the ticket-attachments bucket directly against the
-- Storage REST API, bypassing the app entirely. The bucket's own migration
-- comment says "mirroring ... public read, authenticated write" — the write
-- side never actually enforced that. This is the exact same class of bug
-- add_proposal_storage_hardening.sql already fixed for the proposal buckets;
-- applying the identical fix here. Public SELECT (read) is intentionally
-- left as-is — that's the bucket's real, intended design (attachments need
-- to be viewable via public URL, including from the Client Portal).
DROP POLICY IF EXISTS "Authenticated upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete ticket attachments" ON storage.objects;

CREATE POLICY "Authenticated upload ticket attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Authenticated update ticket attachments" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Authenticated delete ticket attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments');
