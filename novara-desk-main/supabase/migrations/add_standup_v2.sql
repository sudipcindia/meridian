-- ══ STANDUP COMMAND CENTER V2 SCHEMA ══
-- Run this in Supabase SQL Editor after add_standup_updates.sql

-- Add new fields to ticket_standup_updates
ALTER TABLE ticket_standup_updates
  ADD COLUMN IF NOT EXISTS followup_date date,
  ADD COLUMN IF NOT EXISTS discussion_summary text,
  ADD COLUMN IF NOT EXISTS session_id text;

-- Add new fields to promise_standup_updates
ALTER TABLE promise_standup_updates
  ADD COLUMN IF NOT EXISTS followup_date date,
  ADD COLUMN IF NOT EXISTS discussion_summary text,
  ADD COLUMN IF NOT EXISTS session_id text;

-- Create standup_sessions table for session tracking & AI reports
CREATE TABLE IF NOT EXISTS standup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  started_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  started_by_email text NOT NULL,
  started_by_name text,
  sources jsonb,
  items_total integer DEFAULT 0,
  items_saved integer DEFAULT 0,
  items_skipped integer DEFAULT 0,
  ai_report text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ss_session_id ON standup_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ss_started_at ON standup_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_started_by ON standup_sessions(started_by_email);

ALTER TABLE standup_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_ss" ON standup_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
