-- Add logo_url column to clients table
-- Existing rows default to NULL (no logo) — backward compatible
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

-- Create client-logos storage bucket (public read, authenticated write)
-- Run this block if the bucket does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload/update/delete their client logos
CREATE POLICY "Authenticated upload client logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "Authenticated update client logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "Authenticated delete client logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "Public read client logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'client-logos');
