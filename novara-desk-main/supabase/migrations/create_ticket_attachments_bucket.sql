-- The app has long had code paths that upload to a "ticket-attachments"
-- storage bucket — ticket compose file attachments (handleComposeFile),
-- ticket voice notes (sendVoiceNote), and now Quick Task's file attachments
-- and voice capture — but the bucket itself was never created, so every one
-- of those uploads was silently failing and falling back to embedding the
-- file as a base64 data URL. Creating the bucket (mirroring the existing
-- client-logos bucket: public read, authenticated write) fixes all of them
-- at once rather than papering over it in application code.
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

create policy "Public read ticket attachments" on storage.objects
  for select using (bucket_id = 'ticket-attachments');

create policy "Authenticated upload ticket attachments" on storage.objects
  for insert with check (bucket_id = 'ticket-attachments');

create policy "Authenticated update ticket attachments" on storage.objects
  for update using (bucket_id = 'ticket-attachments');

create policy "Authenticated delete ticket attachments" on storage.objects
  for delete using (bucket_id = 'ticket-attachments');
