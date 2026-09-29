-- ══ STANDUP V3 AI SCHEMA EXTENSIONS ══
-- Additive only. Run in Supabase SQL Editor AFTER add_standup_v2.sql.
-- No DROP, no DELETE, no schema breakage.

-- Extend standup_sessions with mode tracking
ALTER TABLE standup_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS member_filter TEXT,
  ADD COLUMN IF NOT EXISTS client_filter TEXT;

-- Extend ticket_standup_updates with AI extraction results
ALTER TABLE ticket_standup_updates
  ADD COLUMN IF NOT EXISTS ai_extracted JSONB;

-- Extend promise_standup_updates with AI extraction results
ALTER TABLE promise_standup_updates
  ADD COLUMN IF NOT EXISTS ai_extracted JSONB;

-- Indexes for mode-based reporting
CREATE INDEX IF NOT EXISTS idx_ss_mode ON standup_sessions(mode);
