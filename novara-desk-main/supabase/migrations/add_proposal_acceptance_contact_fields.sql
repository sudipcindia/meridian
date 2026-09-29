-- ============================================================================
-- Proposal Acceptance: contact fields + duplicate-submission hardening
-- ============================================================================
-- Extends the proposal_builder_acceptances table added in
-- add_proposal_client_delivery.sql (Phase 07) rather than creating a new
-- table — that table is already wired end to end (api/client/accept.ts,
-- signed-PDF stamping, activity log), and follows this schema's established
-- proposal_builder_* naming convention. Creating a second, differently-named
-- acceptance table would duplicate that working infrastructure and fragment
-- where "did this proposal get accepted" lives — this migration is purely
-- additive to it instead.
--
-- This migration is also SELF-HEALING: on at least one environment, the
-- Phase 07 script that was supposed to create proposal_builder_share_links
-- and proposal_builder_acceptances never actually landed (likely because
-- Supabase's SQL editor runs a pasted script as one implicit transaction —
-- if any later statement in that script errored, e.g. the staff-only RLS
-- migration's CREATE POLICY on a table that didn't exist yet, the whole
-- batch rolls back, silently undoing the CREATE TABLE statements earlier in
-- the same run too). Rather than ask for a manual re-run in the right order,
-- this migration recreates anything Phase 07 was supposed to have created —
-- table, index, storage bucket — using IF NOT EXISTS everywhere, and applies
-- the FINAL staff-only RLS policy directly (see add_proposal_staff_auth.sql)
-- rather than the old permissive one, since permissive was only ever meant
-- to be an interim state before staff auth existed.
--
-- Then, three changes on top:
--   1. Five new columns for the acceptance form's Company/Email/Phone
--      fields, plus a proposal_name/client_name SNAPSHOT — captured at
--      acceptance time for the same reason document_version already is:
--      so a later rename of the proposal or an edit to the client's name
--      can never retroactively change what the record shows was agreed to.
--   2. A unique index on proposal_id, promoting the existing app-level
--      check-then-insert duplicate guard in api/client/accept.ts into a
--      real database constraint — closes the narrow race window where two
--      concurrent submissions could both pass the app-level check before
--      either has inserted.
--
-- No new "status" column on this table: the row's mere existence already
-- means "accepted" (there is no "unaccepted" acceptance state to
-- represent), and proposal_builder_proposals.status = 'signed' (displayed
-- to staff as "Accepted", see modules/status/displayStatus.ts) remains the
-- one source of truth for acceptance state — unchanged by this migration.
--
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

-- ── Recreate anything Phase 07 was supposed to have created, if missing ────

CREATE TABLE IF NOT EXISTS proposal_builder_share_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  token        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  revoked_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_share_links_token
  ON proposal_builder_share_links (token);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_share_links_proposal
  ON proposal_builder_share_links (proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS proposal_builder_acceptances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  document_id       uuid NOT NULL REFERENCES proposal_builder_documents(id) ON DELETE CASCADE,
  document_version  integer NOT NULL,

  signer_name       text NOT NULL,
  signature_method  text NOT NULL CHECK (signature_method IN ('drawn', 'typed')),
  signature_path    text,
  signature_text    text,

  accepted_at       timestamptz NOT NULL DEFAULT now(),
  ip_address        text,
  user_agent        text
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_acceptances_proposal
  ON proposal_builder_acceptances (proposal_id, accepted_at DESC);

ALTER TABLE proposal_builder_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_acceptances ENABLE ROW LEVEL SECURITY;

-- Final (staff-only) policy applied directly — matches add_proposal_staff_auth.sql,
-- skipping the old interim "permissive" step since staff auth already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_share_links' AND policyname = 'proposal_builder_share_links_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_share_links_staff_access ON proposal_builder_share_links
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_acceptances' AND policyname = 'proposal_builder_acceptances_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_acceptances_staff_access ON proposal_builder_acceptances
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;

-- Storage bucket for drawn signatures — mirrors proposal-pdfs exactly.
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-signatures', 'proposal-signatures', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='proposal_signatures_select'
  ) THEN
    CREATE POLICY proposal_signatures_select ON storage.objects FOR SELECT USING (bucket_id = 'proposal-signatures');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='proposal_signatures_insert'
  ) THEN
    CREATE POLICY proposal_signatures_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proposal-signatures');
  END IF;
END$$;

-- ── This migration's own additions ──────────────────────────────────────────

ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS proposal_name text NOT NULL DEFAULT '';
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS client_name   text NOT NULL DEFAULT '';
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS company_name  text NOT NULL DEFAULT '';
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS email         text NOT NULL DEFAULT '';
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS phone         text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_acceptances_proposal
  ON proposal_builder_acceptances (proposal_id);
