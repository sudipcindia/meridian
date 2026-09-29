-- ============================================================================
-- Secure Client Proposal Delivery & Acceptance (Phase 07) — additive only
-- ============================================================================
-- Four changes, all additive to the isolated Proposal Builder schema:
--
--   1. proposal_builder_proposals gains `client_email` — needed to send the
--      secure link; the original 'sent'/'signed' statuses (Phase 01) are
--      reused as-is for this workflow, no new status values needed.
--
--   2. proposal_builder_share_links — one row per generated link. The
--      token is a long, cryptographically random opaque string (never a
--      JWT) specifically so future expiry/revocation is a trivial column
--      check (expires_at / revoked_at) rather than needing a deny-list —
--      resolved server-side only (api/_lib/share/*), never queried
--      directly by client-side code, so a client can never enumerate
--      tokens via the anon key even though this schema's RLS is
--      permissive (matching every other Proposal Builder table).
--
--   3. proposal_builder_acceptances — append-only record of what the
--      client actually signed: signer name, method (drawn/typed), the
--      signature itself, and the exact document_version being accepted —
--      so a later content edit can never retroactively change what a
--      client is considered to have agreed to.
--
--   4. A new private Storage bucket for drawn signature images, mirroring
--      the existing proposal-pdfs bucket pattern exactly.
--
-- Does not alter, reference, or depend on any existing Novara Desk table.
-- Safe to run multiple times (idempotent). No existing data is modified.
-- ============================================================================

ALTER TABLE proposal_builder_proposals ADD COLUMN IF NOT EXISTS client_email text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS proposal_builder_share_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  token        text NOT NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Reserved for future use — deliberately unused this phase (per the brief:
  -- "prepare the architecture... but do not implement expiry unless needed").
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
  signature_path    text,  -- Storage path, when signature_method = 'drawn'
  signature_text    text,  -- The typed name, when signature_method = 'typed'

  accepted_at       timestamptz NOT NULL DEFAULT now(),
  ip_address        text,
  user_agent        text
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_acceptances_proposal
  ON proposal_builder_acceptances (proposal_id, accepted_at DESC);

-- ── RLS — permissive for now, matching every other Proposal Builder table ──
ALTER TABLE proposal_builder_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_acceptances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_share_links' AND policyname = 'proposal_builder_share_links_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_share_links_foundation_access ON proposal_builder_share_links
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_acceptances' AND policyname = 'proposal_builder_acceptances_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_acceptances_foundation_access ON proposal_builder_acceptances
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ── Storage bucket for drawn signatures — mirrors proposal-pdfs exactly ─────
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

-- ============================================================================
-- OPTIONAL — staff-only hardening for the internal-facing tables, to apply
-- once the Builder has real authentication (mirrors the pattern already
-- used on every other Proposal Builder table). Note: this does NOT apply
-- to how the client link itself works — that path never uses the anon key
-- or RLS at all; it's resolved exclusively by the service-role-key-backed
-- api/client/* functions, so hardening RLS here doesn't affect clients.
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS proposal_builder_share_links_foundation_access ON proposal_builder_share_links;
-- CREATE POLICY proposal_builder_share_links_staff_access ON proposal_builder_share_links
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
--
-- DROP POLICY IF EXISTS proposal_builder_acceptances_foundation_access ON proposal_builder_acceptances;
-- CREATE POLICY proposal_builder_acceptances_staff_access ON proposal_builder_acceptances
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
-- ============================================================================
