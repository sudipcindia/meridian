-- ══ STANDUP COMMAND CENTER TABLES ══
-- Run this in Supabase SQL Editor before using the Standup feature.

CREATE TABLE IF NOT EXISTS ticket_standup_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL,
  author_email text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  status text NOT NULL, -- 'working'|'blocked'|'waiting_client'|'waiting_team'|'review_pending'|'ready_to_deliver'
  progress integer DEFAULT 0, -- 0, 25, 50, 75, 100
  blocker text,
  expected_resolution_date date,
  update_note text NOT NULL,
  manager_note text,
  commitment_missed boolean DEFAULT false -- true when a prior expected_resolution_date was missed
);

CREATE INDEX IF NOT EXISTS idx_tsu_ticket_id ON ticket_standup_updates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tsu_created_at ON ticket_standup_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tsu_author ON ticket_standup_updates(author_email);

ALTER TABLE ticket_standup_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_tsu" ON ticket_standup_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS promise_standup_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id text NOT NULL,
  plan_id text NOT NULL,
  author_email text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  status text NOT NULL,
  progress integer DEFAULT 0,
  blocker text,
  expected_resolution_date date,
  update_note text NOT NULL,
  manager_note text,
  commitment_missed boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_psu_promise_id ON promise_standup_updates(promise_id);
CREATE INDEX IF NOT EXISTS idx_psu_plan_id ON promise_standup_updates(plan_id);
CREATE INDEX IF NOT EXISTS idx_psu_created_at ON promise_standup_updates(created_at DESC);

ALTER TABLE promise_standup_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_psu" ON promise_standup_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);
