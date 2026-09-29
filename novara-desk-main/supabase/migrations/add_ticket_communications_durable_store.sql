-- Durable, append-only ticket communication store (2026-09).
--
-- ROOT CAUSE THIS FIXES: every ticket write in this app funnels through
-- saveTicketToDB() (index.html), a whole-row upsert that has always included
-- `comms:ticket.comms||[]` in its payload. Any of that function's ~60 call
-- sites — not just the message-compose ones — could fire from a browser tab
-- whose in-memory `comms` array was stale (a missed realtime tick, a
-- backgrounded tab, a second staff member or the Client Portal having
-- appended in the meantime), and the whole-row upsert would silently
-- overwrite the DB with the stale, shorter array. That is exactly what
-- happened to NVR-1279 on 2026-09-23 (~20 messages lost to one surviving).
--
-- THE FIX: comms is no longer written by whole-row replacement anywhere.
-- New messages are inserted as individual rows into ticket_communications
-- (this table) with a unique idempotency_key (safe retries, no duplicates).
-- The trigger below atomically appends each new row into the legacy
-- tickets.comms JSONB column via `comms = comms || x` — a single statement,
-- so Postgres's row-level lock on the `tickets` row serializes concurrent
-- appends correctly. No read-modify-write gap remains anywhere. Every
-- existing read path (internal desk UI, mobile, Client Portal) keeps working
-- unchanged, now backed by a race-free write.
--
-- This table also becomes the ONE place full-fidelity data (untruncated
-- body, sender/recipient, direction, resend_message_id, delivery status,
-- attachments metadata) lives — `notifications` remains alert/preview-only
-- and is never read back as a source of truth.
--
-- Nothing existing is deleted, migrated destructively, or rewritten:
-- tickets.comms is preserved exactly as-is and is additionally backfilled
-- (copied, not moved) into this table below so historical messages have
-- full-fidelity backing too.

CREATE TABLE IF NOT EXISTS ticket_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('staff','client','system')),
  sender_id text,
  sender_name text,
  recipient text,
  direction text NOT NULL CHECK (direction IN ('staff_to_client','client_to_staff','internal','system')),
  visibility text NOT NULL DEFAULT 'client_visible' CHECK (visibility IN ('client_visible','internal_only')),
  message_type text NOT NULL DEFAULT 'text',
  subject text,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  resend_message_id text,
  send_status text NOT NULL DEFAULT 'not_applicable' CHECK (send_status IN ('not_applicable','pending','sent','failed')),
  send_error text,
  retry_count integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL UNIQUE,
  edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  legacy_comm_id text,
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live','backfill_migration')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_ticket_communications_ticket_time ON ticket_communications (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_communications_client_time ON ticket_communications (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_communications_pending_send ON ticket_communications (send_status) WHERE send_status IN ('pending','failed');

ALTER TABLE ticket_communications ENABLE ROW LEVEL SECURITY;

-- Matches the existing tickets/clients/notifications convention exactly:
-- the internal desk app authenticates staff via Supabase Auth, so RLS gates
-- on auth.role()='authenticated'; the Client Portal never talks to Supabase
-- directly (it is a custom-JWT system mediated entirely by the api/portal/*
-- Vercel functions using the service-role key, which bypasses RLS as it
-- already does for every other table).
CREATE POLICY "Authenticated users can read ticket_communications"
  ON ticket_communications FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert ticket_communications"
  ON ticket_communications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update ticket_communications"
  ON ticket_communications FOR UPDATE
  USING (auth.role() = 'authenticated');

-- No DELETE policy for anyone (including service role bypass aside) — this
-- table is append-only by design. "Deleting" a message is modeled as
-- setting deleted=true, matching the existing tickets.comms soft-delete
-- convention in api/portal/tickets.js, never a real row removal.

CREATE OR REPLACE FUNCTION mirror_ticket_communication_to_legacy_comms()
RETURNS trigger AS $$
BEGIN
  UPDATE tickets
  SET comms = COALESCE(comms, '[]'::jsonb) || jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'id', COALESCE(NEW.legacy_comm_id, NEW.id::text),
      'author', NEW.sender_id,
      'mode', CASE
        WHEN NEW.message_type = 'system_log' THEN 'system_log'
        WHEN NEW.message_type = 'ticket_thread' AND NEW.direction = 'client_to_staff' THEN 'ticket-thread-in'
        WHEN NEW.message_type = 'ticket_thread' AND NEW.direction = 'system' THEN 'ticket-thread-header'
        WHEN NEW.message_type = 'ticket_thread' THEN 'ticket-thread-out'
        WHEN NEW.message_type = 'telegram' AND NEW.direction = 'client_to_staff' THEN 'telegram-in'
        WHEN NEW.message_type = 'telegram' THEN 'telegram-out'
        WHEN NEW.visibility = 'internal_only' THEN 'internal'
        WHEN NEW.direction = 'client_to_staff' THEN 'client-in'
        ELSE 'client-out'
      END,
      'text', NEW.body,
      'subject', NEW.subject,
      'time', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attachments', NEW.attachments,
      'audioUrl', NEW.metadata->>'audioUrl',
      'audioDuration', (NEW.metadata->>'audioDuration')::numeric,
      'locked', (NEW.metadata->>'locked')::boolean
    ))
  )
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_mirror_ticket_communication ON ticket_communications;
CREATE TRIGGER trg_mirror_ticket_communication
AFTER INSERT ON ticket_communications
FOR EACH ROW
WHEN (NEW.source = 'live')
EXECUTE FUNCTION mirror_ticket_communication_to_legacy_comms();

-- One-time, additive, non-destructive backfill. tickets.comms is only READ
-- here, never written — every existing entry is copied into the new table
-- exactly as it stands today, tagged source='backfill_migration' so the
-- trigger above (WHEN source='live') does not re-append these into
-- tickets.comms a second time.
INSERT INTO ticket_communications (
  ticket_id, client_id, sender_type, sender_id, direction, visibility,
  message_type, subject, body, attachments, idempotency_key, legacy_comm_id,
  source, created_at, created_by, metadata
)
SELECT
  t.id,
  t.client,
  CASE WHEN c->>'mode' IN ('client-in','telegram-in','ticket-thread-in') THEN 'client'
       WHEN c->>'mode' = 'system_log' THEN 'system'
       ELSE 'staff' END,
  c->>'author',
  CASE WHEN c->>'mode' = 'ticket-thread-header' THEN 'system'
       WHEN c->>'mode' IN ('client-in','telegram-in','ticket-thread-in') THEN 'client_to_staff'
       WHEN c->>'mode' = 'system_log' THEN 'system'
       WHEN c->>'mode' = 'internal' THEN 'internal'
       ELSE 'staff_to_client' END,
  CASE WHEN c->>'mode' = 'internal' THEN 'internal_only' ELSE 'client_visible' END,
  CASE WHEN c->>'mode' LIKE 'telegram%' THEN 'telegram'
       WHEN c->>'mode' LIKE 'ticket-thread%' THEN 'ticket_thread'
       WHEN c->>'mode' = 'system_log' THEN 'system_log'
       WHEN COALESCE(c->>'audioUrl','') <> '' THEN 'voice_note'
       WHEN COALESCE(c->>'text','') = '' AND jsonb_array_length(COALESCE(c->'attachments','[]'::jsonb)) > 0 THEN 'attachment'
       ELSE 'text' END,
  c->>'subject',
  COALESCE(c->>'text', ''),
  COALESCE(c->'attachments', '[]'::jsonb),
  'backfill_' || t.id || '_' || COALESCE(c->>'id', md5(c::text)),
  c->>'id',
  'backfill_migration',
  CASE WHEN c->>'time' ~ '^\d{4}-\d{2}-\d{2}T' THEN (c->>'time')::timestamptz ELSE t.created_at END,
  'migration:add_ticket_communications_durable_store',
  jsonb_strip_nulls(jsonb_build_object('audioUrl', c->>'audioUrl', 'audioDuration', c->>'audioDuration', 'locked', c->>'locked'))
FROM tickets t, jsonb_array_elements(COALESCE(t.comms, '[]'::jsonb)) c
WHERE jsonb_typeof(t.comms) = 'array'
ON CONFLICT (idempotency_key) DO NOTHING;

-- notifications gets a nullable pointer back to the durable communication
-- row it was raised for, so the notify-email edge function (invoked by the
-- existing send-email-on-notification webhook) can write the Resend
-- message id and delivery status back onto that exact row after sending —
-- closing the loop required by "store resend id + delivery result",
-- without notifications ever becoming the source of truth for the message
-- content itself.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comm_id uuid REFERENCES ticket_communications(id) ON DELETE SET NULL;
