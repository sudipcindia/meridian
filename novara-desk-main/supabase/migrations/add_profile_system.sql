-- =============================================================
-- Novara Desk — Profile System Upgrade
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to run multiple times. No existing data is modified.
-- =============================================================

-- ── 1. Extend team_members with profile fields ───────────────
-- All columns are nullable / defaulted so existing rows are untouched
-- and the app stays backward compatible (initials remain the fallback).
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS profile_photo_url text DEFAULT NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS bio              text DEFAULT NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS skills           jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS joined_date      date DEFAULT NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS preferences      jsonb DEFAULT '{}'::jsonb;

-- ── 2. Storage bucket for profile photos ─────────────────────
-- (mirrors report-uploads in reports_setup.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage RLS policies ──────────────────────────────────
-- Public read; authenticated upload/update/delete. Photos are
-- namespaced by member id in the object key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='profile_photos_select'
  ) THEN
    CREATE POLICY profile_photos_select ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='profile_photos_insert'
  ) THEN
    CREATE POLICY profile_photos_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='profile_photos_update'
  ) THEN
    CREATE POLICY profile_photos_update ON storage.objects FOR UPDATE USING (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='profile_photos_delete'
  ) THEN
    CREATE POLICY profile_photos_delete ON storage.objects FOR DELETE USING (bucket_id = 'profile-photos');
  END IF;
END$$;
