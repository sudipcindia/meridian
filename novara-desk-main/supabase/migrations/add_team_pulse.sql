-- Team Pulse (2026-09) — AI-driven daily check-in feature, built on top of
-- existing infrastructure (tickets, team_members, notifications, the
-- Admin/Developer/Operations permission gate). Every table here is NEW and
-- ADDITIVE — nothing existing is touched, no existing table is altered.
--
-- V1 scope note: scheduling here is DATA ONLY (per-user enabled/time +
-- global weekly day toggles). The actual proactive server-side trigger
-- (a Supabase Edge Function + its own pg_cron entry, mirroring
-- daily_briefing_cron.sql's pattern) is a separate, later piece of work —
-- this schema is designed so that function can read directly from these
-- tables without any further schema change.

-- Per-user Team Pulse participation + their own scheduled time.
CREATE TABLE IF NOT EXISTS team_pulse_settings (
  user_id text PRIMARY KEY REFERENCES team_members(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  scheduled_time time NOT NULL DEFAULT '09:00',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Global weekly schedule (which days Team Pulse runs at all). Seeded with a
-- sensible Mon-Fri default below, but every row is editable from Team
-- Pulse -> Settings — nothing about the week is hardcoded in application
-- code.
CREATE TABLE IF NOT EXISTS team_pulse_weekly_schedule (
  day text PRIMARY KEY CHECK (day IN ('mon','tue','wed','thu','fri','sat','sun')),
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO team_pulse_weekly_schedule (day, enabled) VALUES
  ('mon', true), ('tue', true), ('wed', true), ('thu', true), ('fri', true),
  ('sat', false), ('sun', false)
ON CONFLICT (day) DO NOTHING;

-- One row per Team Pulse conversation. source distinguishes a real
-- scheduled run from a developer's manual/on-demand start, and is_test
-- lets a developer exercise the real engine (real tickets, real AI calls)
-- without the session counting toward real reports or rewards.
CREATE TABLE IF NOT EXISTS team_pulse_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  pulse_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('scheduled','manual')),
  is_test boolean NOT NULL DEFAULT false,
  points_awarded boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_team_pulse_sessions_user_date ON team_pulse_sessions (user_id, pulse_date);

-- Full conversation transcript for a session — Alley's messages and the
-- user's replies, plus which ticket (if any) a message was about, so the
-- ticket-reference component always has a real id to link to.
CREATE TABLE IF NOT EXISTS team_pulse_messages (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL REFERENCES team_pulse_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('alley','user')),
  content text NOT NULL,
  ticket_id text,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_pulse_messages_session ON team_pulse_messages (session_id, created_at);

-- Durable commitment memory ("I'll finish this tomorrow") — deliberately a
-- real table, not Alley's existing 5-minute-TTL chat cache, since this must
-- survive across days.
CREATE TABLE IF NOT EXISTS team_pulse_commitments (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  ticket_id text,
  session_id text REFERENCES team_pulse_sessions(id) ON DELETE SET NULL,
  commitment_text text NOT NULL,
  expected_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','broken','carried')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_team_pulse_commitments_user_status ON team_pulse_commitments (user_id, status);

-- Meridian Points ledger — a running total is SUM(points), never a single
-- mutable balance column, so it can never be silently overwritten.
CREATE TABLE IF NOT EXISTS team_pulse_rewards (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  session_id text REFERENCES team_pulse_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_pulse_rewards_user ON team_pulse_rewards (user_id);

-- Audit trail for every Team-Pulse-initiated change to a real ticket
-- (reassignment, deadline, priority, status) — this is IN ADDITION TO, and
-- never a replacement for, whatever the ticket's own comms/history already
-- record; nothing here ever overwrites existing ticket communications.
CREATE TABLE IF NOT EXISTS team_pulse_audit (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  user_id text NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  ticket_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  session_id text REFERENCES team_pulse_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_pulse_audit_ticket ON team_pulse_audit (ticket_id);

ALTER TABLE team_pulse_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_pulse_audit ENABLE ROW LEVEL SECURITY;

-- Staff-only feature (internal desk app, Supabase-Auth-authenticated) —
-- same convention as ticket_comms_read_state/app_settings: authenticated
-- users can read/write; the real access control is Team Pulse's own
-- restrictedAreaAllowed() gate in the application layer, same as every
-- other Admin/Developer/Operations-only area of this app already works.
CREATE POLICY "auth_read" ON team_pulse_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_weekly_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_weekly_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_commitments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_commitments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read" ON team_pulse_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON team_pulse_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);
