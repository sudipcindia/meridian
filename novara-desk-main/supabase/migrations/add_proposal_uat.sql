-- ============================================================================
-- Phase 10 — Internal UAT & Production Release Preparation
-- ============================================================================
-- Three additions, all additive, all scoped to the isolated Proposal
-- Builder schema, all staff-only from creation (mirrors
-- add_proposal_staff_auth.sql's established rule):
--
--   1. proposal_builder_uat_checklist — per-proposal validation checklist
--      (14 fixed items: variables, preview, ai_content, pdf_generation,
--      email_delivery, secure_link, client_readonly_view, esignature,
--      acceptance, notifications, signed_pdf, timeline, audit_trail,
--      ops_intel_status). One row per (proposal_id, item_key); upserted
--      by the UAT UI in Ops Intel, never by the client-facing app.
--
--   2. proposal_builder_issues — internal bug/improvement/enhancement/
--      blocker tracker. `proposal_id` is nullable: an issue can be scoped
--      to the specific proposal under test, or general (e.g. "PDF
--      generation slow under load").
--
--   3. proposal_builder_release_checklist — ONE global checklist (not
--      per-proposal) of the 14 release-readiness items from the brief.
--      Seeded with all 14 rows below so the UI only ever needs to
--      UPDATE, never decide whether to INSERT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_builder_uat_checklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,
  item_key      text NOT NULL,
  passed        boolean NOT NULL DEFAULT false,
  checked_by    text,
  checked_at    timestamptz,
  notes         text
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_builder_uat_checklist_item
  ON proposal_builder_uat_checklist (proposal_id, item_key);

CREATE TABLE IF NOT EXISTS proposal_builder_issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  type          text NOT NULL CHECK (type IN ('bug', 'improvement', 'enhancement', 'blocker')),
  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority      text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  assigned_to   text,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_proposal_builder_issues_created
  ON proposal_builder_issues (created_at DESC);

CREATE TABLE IF NOT EXISTS proposal_builder_release_checklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key      text NOT NULL UNIQUE,
  label         text NOT NULL,
  passed        boolean NOT NULL DEFAULT false,
  checked_by    text,
  checked_at    timestamptz,
  notes         text
);

INSERT INTO proposal_builder_release_checklist (item_key, label) VALUES
  ('proposal_creation', 'Proposal Creation'),
  ('proposal_editing', 'Proposal Editing'),
  ('ai_assistant', 'AI Assistant'),
  ('variable_engine', 'Variable Engine'),
  ('pdf', 'PDF'),
  ('email', 'Email'),
  ('signature', 'Signature'),
  ('acceptance', 'Acceptance'),
  ('notifications', 'Notifications'),
  ('audit_logs', 'Audit Logs'),
  ('responsive', 'Responsive'),
  ('browser_testing', 'Browser Testing'),
  ('performance', 'Performance'),
  ('security', 'Security')
ON CONFLICT (item_key) DO NOTHING;

ALTER TABLE proposal_builder_uat_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_builder_release_checklist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_uat_checklist' AND policyname = 'proposal_builder_uat_checklist_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_uat_checklist_staff_access ON proposal_builder_uat_checklist
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_issues' AND policyname = 'proposal_builder_issues_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_issues_staff_access ON proposal_builder_issues
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_builder_release_checklist' AND policyname = 'proposal_builder_release_checklist_staff_access'
  ) THEN
    CREATE POLICY proposal_builder_release_checklist_staff_access ON proposal_builder_release_checklist
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
