-- ══ OUTREACH MODULE — PHASE 6 (optional): CLIENT ONBOARDING CHECKLIST ══
-- Source: docs/outreach-module-functional-analysis.md §3.9. The workbook's
-- Onboarding sheet is a genuinely different data shape from the CRM tables
-- (a 17-item task checklist, not an opportunity record) and was a SINGLE
-- HARDCODED TEMPLATE — onboarding a second client meant duplicating the
-- whole sheet by hand. This migration makes it a real one-checklist-per-
-- client table, seeded with the exact 17 real action items transcribed
-- directly from the workbook (re-read directly from the source .xlsx for
-- this phase to get them verbatim, not paraphrased).
--
-- The workbook's one real instance (client "Simon", only item 1 filled in:
-- Owner=Client, Status=Complete, everything else blank) is imported as the
-- first real checklist, per the same "preserve history exactly as entered"
-- principle used in Phase 1 for the Sales Pipeline import.

CREATE TABLE IF NOT EXISTS outreach_onboarding_checklists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name    text NOT NULL,
  opportunity_id uuid REFERENCES outreach_opportunities(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_onboarding_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id   uuid NOT NULL REFERENCES outreach_onboarding_checklists(id) ON DELETE CASCADE,
  sort_order     integer NOT NULL,
  action_item    text NOT NULL,
  owner          text,                          -- 'Client' | 'Novara' | 'Both' — free text, matches the source's own dropdown, no CHECK constraint (same reasoning as outreach_opportunities: real data doesn't always match the dropdown exactly)
  target_timing  date,
  status         text NOT NULL DEFAULT 'Pending', -- 'Pending' | 'In Progress' | 'Completed'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_onb_items_checklist ON outreach_onboarding_items(checklist_id, sort_order);

ALTER TABLE outreach_onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_onboarding_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outreach_onboarding_checklists' AND policyname='auth_rw_outreach_onboarding_checklists') THEN
    CREATE POLICY "auth_rw_outreach_onboarding_checklists" ON outreach_onboarding_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outreach_onboarding_items' AND policyname='auth_rw_outreach_onboarding_items') THEN
    CREATE POLICY "auth_rw_outreach_onboarding_items" ON outreach_onboarding_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Historical import: client "Simon", the workbook's one real instance.
DO $$
DECLARE
  v_checklist_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM outreach_onboarding_checklists WHERE client_name = 'Simon') THEN
    INSERT INTO outreach_onboarding_checklists (client_name) VALUES ('Simon') RETURNING id INTO v_checklist_id;
    INSERT INTO outreach_onboarding_items (checklist_id, sort_order, action_item, owner, status) VALUES
      (v_checklist_id, 0, 'Confirm contracting entity and provide company registration details', 'Client', 'Complete'),
      (v_checklist_id, 1, 'Issue / update contract and invoice', NULL, 'Pending'),
      (v_checklist_id, 2, 'Sign contract and settle invoice', NULL, 'Pending'),
      (v_checklist_id, 3, 'Confirm campaign scope, target sector(s) and Ideal Customer Profile (ICP)', NULL, 'Pending'),
      (v_checklist_id, 4, 'Purchase sending domains and supporting infrastructure', NULL, 'Pending'),
      (v_checklist_id, 5, 'Provide shortlist of candidate domains', NULL, 'Pending'),
      (v_checklist_id, 6, 'Select domains from shortlist provided', NULL, 'Pending'),
      (v_checklist_id, 7, 'Purchase email (Google) and SMTP infrastructure; begin inbox warm-up', NULL, 'Pending'),
      (v_checklist_id, 8, 'Provide client data / target list for enrichment (if applicable)', NULL, 'Pending'),
      (v_checklist_id, 9, 'Deliver test data sample (e.g. ~30 contacts) for client review', NULL, 'Pending'),
      (v_checklist_id, 10, 'Review and approve test data sample', NULL, 'Pending'),
      (v_checklist_id, 11, 'Submit clarifying questions arising from client data', NULL, 'Pending'),
      (v_checklist_id, 12, 'Complete enrichment on target decision-makers', NULL, 'Pending'),
      (v_checklist_id, 13, 'Present initial ICP and messaging strategy', NULL, 'Pending'),
      (v_checklist_id, 14, 'Complete inbox warm-up period', NULL, 'Pending'),
      (v_checklist_id, 15, 'Launch outbound campaign', NULL, 'Pending'),
      (v_checklist_id, 16, 'Schedule recurring check-in call', NULL, 'Pending');
  END IF;
END $$;
