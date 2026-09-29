-- Per-user "last read" markers for the My Tickets chat indicator (2026-09).
-- Deliberately NOT a duplicate communication system and NOT touching
-- ticket_communications/tickets.comms at all — this only stores, per staff
-- user per ticket, the timestamp up to which they've seen the client
-- conversation and the internal-notes conversation. Unread state is derived
-- at read time by comparing these timestamps against the newest relevant
-- entry in the existing comms data — never a global read=true flag.
CREATE TABLE IF NOT EXISTS ticket_comms_read_state (
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  last_read_client_at timestamptz,
  last_read_internal_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_comms_read_state_user ON ticket_comms_read_state (user_id);

ALTER TABLE ticket_comms_read_state ENABLE ROW LEVEL SECURITY;

-- Staff-only feature (internal desk app, Supabase-Auth-authenticated) —
-- same convention as tickets/clients/ticket_communications. The Client
-- Portal never touches this table.
CREATE POLICY "Authenticated users can read ticket_comms_read_state"
  ON ticket_comms_read_state FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upsert their own read state"
  ON ticket_comms_read_state FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their own read state"
  ON ticket_comms_read_state FOR UPDATE
  USING (auth.role() = 'authenticated');
