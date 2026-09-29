-- ============================================================================
-- Proposal Builder — Foundation schema (metadata/content split)
-- ============================================================================
-- Two new, fully isolated tables for the internal Proposal Builder module.
-- Does not alter, reference, or depend on any existing Novara Desk table.
-- Safe to run multiple times (idempotent), including if an earlier version
-- of this migration (single-table shape) was already applied — see the
-- backfill step below, which migrates any existing `version`/`pages` data
-- into the new `proposal_builder_documents` table before dropping them from
-- `proposal_builder_proposals`. No proposal data is ever lost.
--
-- Architecture:
--   proposal_builder_proposals  — metadata only (client, status, ownership).
--   proposal_builder_documents  — the actual content instance: which master
--                                 template version it was duplicated from,
--                                 its own document_version (bumped as the
--                                 client's content is edited — unrelated to
--                                 the master template's version), which
--                                 pages it includes, and a `variables` jsonb
--                                 column reserved for the future Variable
--                                 Engine (empty object until then).
-- One document per proposal today (see UNIQUE constraint below) — Version
-- History (future) will relax this to many documents per proposal with a
-- "current" marker, without needing to change the FK direction.
--
-- Security note: as in Phase 01, no staff authentication is wired into the
-- Builder app yet, so RLS is enabled with a permissive policy on both
-- tables for now. Tighten to the staff-only pattern (commented at the
-- bottom) once the Builder has real authentication.
-- ============================================================================

-- ── 1. Proposals (metadata) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_builder_proposals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  client_name       text NOT NULL DEFAULT '',
  client_first_name text NOT NULL DEFAULT '',
  company_name      text NOT NULL DEFAULT '',

  proposal_name     text NOT NULL,
  proposal_type     text NOT NULL DEFAULT '',

  status            text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'internal_review', 'ready', 'sent', 'signed', 'archived')),

  prepared_by       text NOT NULL DEFAULT '',
  notes             text DEFAULT '',

  -- Lineage: which proposal (if any) this one was duplicated from.
  duplicated_from   uuid REFERENCES proposal_builder_proposals(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_proposals_status
  ON proposal_builder_proposals (status);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_proposals_updated
  ON proposal_builder_proposals (updated_at DESC);

-- ── 2. Documents (template content instance) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_builder_documents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  proposal_id              uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  -- Which version of the single, frozen master template this was created from.
  master_template_version  integer NOT NULL DEFAULT 1,

  -- This document's own revision number (distinct from master_template_version).
  document_version         integer NOT NULL DEFAULT 1,

  -- Which of the 11 master template pages this document includes.
  pages                    jsonb NOT NULL DEFAULT
                             '["cover","page02","page03","page04","page05","page06","page07","page08","page09","page10","page11"]'::jsonb,

  -- Structured placeholder values for the future Variable Engine. Empty until Phase 02.
  variables                jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- One document per proposal today (see note above on future Version History).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_documents_proposal
  ON proposal_builder_documents (proposal_id);

-- ── 3. Backfill — migrate any pre-existing single-table data, then drop it ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_builder_proposals' AND column_name = 'version'
  ) THEN
    INSERT INTO proposal_builder_documents (proposal_id, master_template_version, document_version, pages, variables)
    SELECT p.id, 1, COALESCE(p.version, 1),
           COALESCE(p.pages, '["cover","page02","page03","page04","page05","page06","page07","page08","page09","page10","page11"]'::jsonb),
           '{}'::jsonb
    FROM proposal_builder_proposals p
    WHERE NOT EXISTS (SELECT 1 FROM proposal_builder_documents d WHERE d.proposal_id = p.id);

    ALTER TABLE proposal_builder_proposals DROP COLUMN IF EXISTS version;
    ALTER TABLE proposal_builder_proposals DROP COLUMN IF EXISTS pages;
  END IF;
END$$;

-- ── 4. RLS — permissive for the Foundation phase (see note above) ───────────
ALTER TABLE proposal_builder_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_proposals' AND policyname = 'proposal_builder_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_foundation_access ON proposal_builder_proposals
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_documents' AND policyname = 'proposal_builder_documents_foundation_access'
  ) THEN
    CREATE POLICY proposal_builder_documents_foundation_access ON proposal_builder_documents
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================================
-- OPTIONAL — staff-only hardening, to apply once the Builder has real
-- authentication (mirrors the pattern in add_client_portal.sql). Rollback:
-- DROP POLICY <name> ON <table>; then re-create the *_foundation_access ones.
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS proposal_builder_foundation_access ON proposal_builder_proposals;
-- CREATE POLICY proposal_builder_staff_access ON proposal_builder_proposals
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
--
-- DROP POLICY IF EXISTS proposal_builder_documents_foundation_access ON proposal_builder_documents;
-- CREATE POLICY proposal_builder_documents_staff_access ON proposal_builder_documents
--   FOR ALL TO authenticated
--   USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
--   WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
-- ============================================================================
