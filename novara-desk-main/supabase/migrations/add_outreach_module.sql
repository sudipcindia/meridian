-- ══ OUTREACH MODULE — PHASE 1: FOUNDATION ══
-- Source of truth analysed and migrated: docs/Upwork Sales Pipeline Tracker.xlsx
-- See docs/outreach-module-functional-analysis.md for the full functional analysis
-- this schema is built from (sheet-by-sheet breakdown, every formula, every
-- broken reference, every data-quality finding).
--
-- Approved Phase 0 decisions this migration honours:
--   1. Historical Excel data is preserved exactly as entered — the 9 real
--      Sales Pipeline rows use "Opportunity" as their stage, which is not one
--      of the 10 canonical dropdown stages. Rather than guess a remapping,
--      "Opportunity" is seeded below as its own (legacy) stage row, so the
--      import is lossless. Reassigning those 9 rows to a real stage is a
--      manual, per-record action for later, once an edit UI exists.
--   2. Currency is stored per record (no FX conversion logic in this phase).
--      Sales Pipeline/Closed Deals amounts were USD-formatted in the source
--      workbook; Credits Tracker amounts were GBP-formatted (its own
--      "Currency" column existed but was left blank on every real row — the
--      actual currency is only evidenced by cell formatting). Both are
--      captured explicitly here rather than left to guesswork later.
--
-- Design choice worth flagging: Excel split "open opportunities" (Sales
-- Pipeline) and "won deals" (Closed Deals) into two sheets with no link
-- between them — winning a deal meant retyping the client from scratch
-- (functional analysis §3.3). This migration merges them into ONE table,
-- outreach_opportunities, with stage as the single source of truth for
-- open/closed state. The 6 real Closed Deals rows import as opportunities
-- with stage 'closed_won' — they were checked against the 9 Sales Pipeline
-- names first and share no client in common, so this is a lossless split
-- import, not a merge/guess (see functional analysis §7 for the reasoning).
--
-- Idempotent throughout: every DDL statement uses IF NOT EXISTS, and every
-- historical-data INSERT is keyed by an explicit import_key (or, for daily
-- activity, the natural activity_date unique constraint) with ON CONFLICT DO
-- NOTHING, so re-running this file is always safe.

-- ── 1. Stage lookup ────────────────────────────────────────────────────────
-- Replaces Lists!A:B. Unlike the source workbook, probability_pct here is
-- actually wired up for use (Lists' probability column was defined but never
-- referenced by any live Excel formula — functional analysis §3.2/§6).

CREATE TABLE IF NOT EXISTS outreach_stages (
  key            text PRIMARY KEY,
  label          text NOT NULL,
  sort_order     integer NOT NULL,
  probability_pct numeric,          -- null = not yet assigned (legacy stage)
  is_open        boolean NOT NULL DEFAULT true,
  is_won         boolean NOT NULL DEFAULT false,
  color          text,              -- solid accent hex; UI derives a tinted bg from it
  is_legacy      boolean NOT NULL DEFAULT false,  -- true only for 'opportunity' — imported as-is, not a real workflow stage
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO outreach_stages (key, label, sort_order, probability_pct, is_open, is_won, color, is_legacy) VALUES
  ('proposal_sent',              'Proposal Sent',              10, 0.10, true,  false, '#2E6BFF', false),
  ('responded',                  'Responded',                  20, 0.20, true,  false, '#2E6BFF', false),
  ('discovery_call_scheduled',   'Discovery Call Scheduled',   30, 0.30, true,  false, '#C98500', false),
  ('discovery_completed',        'Discovery Completed',        40, 0.40, true,  false, '#C98500', false),
  ('proposal_submitted',         'Proposal Submitted',         50, 0.50, true,  false, '#1565C0', false),
  ('negotiation',                'Negotiation',                60, 0.70, true,  false, '#B15C00', false),
  ('follow_up',                  'Follow-up',                  70, 0.40, true,  false, '#92720A', false),
  ('on_hold',                    'On Hold',                    80, 0.20, true,  false, '#5F5F5F', false),
  ('closed_won',                 'Closed Won',                 90, 1.00, false, true,  '#1E6B33', false),
  ('closed_lost',                'Closed Lost',                100, 0.00, false, false, '#A31515', false),
  ('opportunity',                'Opportunity (legacy — needs review)', 5, NULL, true, false, '#6B6B6B', true)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Core CRM table ──────────────────────────────────────────────────────
-- Replaces Sales Pipeline + Closed Deals combined (see design note above).
-- proposal_value/expected_revenue mirror Sales Pipeline's own two separate
-- columns (in the real data these are always identical, but the workbook
-- treats them as distinct concepts, so this preserves that shape); revenue
-- and sales_cycle_days are populated once a deal reaches a closed stage.

CREATE TABLE IF NOT EXISTS outreach_opportunities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name        text NOT NULL,
  company            text,
  proposal_date      date,
  proposal_value     numeric,
  currency           text NOT NULL DEFAULT 'USD',
  stage_key          text NOT NULL REFERENCES outreach_stages(key),
  expected_revenue   numeric,
  last_follow_up_date date,
  deal_owner_id      text REFERENCES team_members(id),
  deal_owner_name    text,          -- raw value preserved even if deal_owner_id can't be resolved
  won_lost_reason    text,
  closed_date        date,
  revenue            numeric,       -- actual/final revenue once closed (Closed Deals!E)
  sales_cycle_days   integer,       -- preserved literal value from the source sheet, not recomputed
  project_type       text,          -- free text — real data didn't match the Lists dropdown values, so no CHECK constraint
  payment_received   text,          -- free text — real data used 'Y'/'N', not the "Yes/No/Partial" dropdown text, so no CHECK constraint
  notes              text,
  source_sheet       text NOT NULL DEFAULT 'manual',  -- 'sales_pipeline' | 'closed_deals' | 'manual' — import provenance
  import_key         text UNIQUE,   -- traces each imported row back to its exact source cell, e.g. 'sales_pipeline_row_2'
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_opp_stage       ON outreach_opportunities(stage_key);
CREATE INDEX IF NOT EXISTS idx_outreach_opp_owner       ON outreach_opportunities(deal_owner_id);
CREATE INDEX IF NOT EXISTS idx_outreach_opp_closed_date ON outreach_opportunities(closed_date);

ALTER TABLE outreach_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_outreach_opportunities" ON outreach_opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Daily activity log ──────────────────────────────────────────────────
-- Replaces Daily Tracker. response_rate is intentionally NOT stored — it's a
-- pure derived ratio (Responses ÷ Proposals), computed at query/read time.

CREATE TABLE IF NOT EXISTS outreach_daily_activity (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_date      date NOT NULL UNIQUE,
  proposals_sent     integer NOT NULL DEFAULT 0,
  responses_received integer NOT NULL DEFAULT 0,
  notes              text,
  logged_by          text REFERENCES team_members(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_daily_date ON outreach_daily_activity(activity_date DESC);

ALTER TABLE outreach_daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_outreach_daily_activity" ON outreach_daily_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Upwork Connects (credits) ledger ────────────────────────────────────
-- Replaces Credits Tracker. currency defaults to GBP because that's what the
-- real historical amounts actually are (evidenced by cell formatting in the
-- source workbook, not by the sheet's own — unused — Currency column).

CREATE TABLE IF NOT EXISTS outreach_credits_purchases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date      date NOT NULL,
  credits_purchased  integer NOT NULL,
  amount_paid        numeric NOT NULL,
  currency           text NOT NULL DEFAULT 'GBP',
  notes              text,
  import_key         text UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_credits_date ON outreach_credits_purchases(purchase_date DESC);

ALTER TABLE outreach_credits_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_rw_outreach_credits_purchases" ON outreach_credits_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Historical data import ──────────────────────────────────────────────
-- Every value below is transcribed directly from the workbook — see
-- docs/outreach-module-functional-analysis.md §3 for the full sheet dumps
-- this was verified against.

-- 5a. Daily Tracker → outreach_daily_activity (14 real rows, Jul 1-16 2026,
--     business days only — Sundays Jul 5/12/19 were never logged, matching
--     the source workbook exactly)
INSERT INTO outreach_daily_activity (activity_date, proposals_sent, responses_received)
VALUES
  ('2026-07-01', 3,  1),
  ('2026-07-02', 6,  0),
  ('2026-07-03', 1,  0),
  ('2026-07-04', 0,  0),
  ('2026-07-06', 5,  0),
  ('2026-07-07', 12, 1),
  ('2026-07-08', 12, 3),
  ('2026-07-09', 4,  2),
  ('2026-07-10', 7,  2),
  ('2026-07-11', 0,  0),
  ('2026-07-13', 15, 3),
  ('2026-07-14', 12, 1),
  ('2026-07-15', 10, 0),
  ('2026-07-16', 2,  1)
ON CONFLICT (activity_date) DO NOTHING;

-- 5b. Sales Pipeline → outreach_opportunities (9 real rows, all stage
--     'opportunity' — preserved exactly as entered, per Decision 1. All 9
--     have Deal Owner "Sahil" in the source; resolved to Sahil Jaswani's
--     real team_members row by email where it exists, raw name always kept.)
INSERT INTO outreach_opportunities
  (client_name, company, proposal_value, currency, stage_key, expected_revenue, deal_owner_id, deal_owner_name, source_sheet, import_key)
SELECT * FROM (VALUES
  ('Andrew Barnett', 'Stilyo Apps LTD', 1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_2'),
  ('Chris Powell',   NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_3'),
  ('Vidhyarti Ram',  'Rank Care',       1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_4'),
  ('Rita Cojuhari',  NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_5'),
  ('Gil Gabay',      NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_6'),
  ('Arthur De Jar',  NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_7'),
  ('Ezekil Aigbe',   NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_8'),
  ('Louis L',        NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_9'),
  ('Stuart Graham',  NULL,              1200::numeric, 'USD', 'opportunity', 1200::numeric, (SELECT id FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk'), 'Sahil', 'sales_pipeline', 'sales_pipeline_row_10')
) AS v(client_name, company, proposal_value, currency, stage_key, expected_revenue, deal_owner_id, deal_owner_name, source_sheet, import_key)
WHERE NOT EXISTS (SELECT 1 FROM outreach_opportunities o WHERE o.import_key = v.import_key);

-- 5c. Closed Deals → outreach_opportunities (6 real rows, stage 'closed_won'.
--     sales_cycle_days is imported as the literal value from the sheet (30
--     for every row) even though Proposal Date was empty for all 6 there —
--     that 30 was a hand-entered/estimated value in Excel, not a computed
--     one; preserved as-is rather than nulled out, per Decision 1. Payment
--     Received kept as the exact literal 'Y'/'N' from the sheet, not
--     normalised to the dropdown's "Yes"/"No" text.)
INSERT INTO outreach_opportunities
  (client_name, company, closed_date, revenue, currency, stage_key, sales_cycle_days, project_type, payment_received, source_sheet, import_key)
SELECT * FROM (VALUES
  ('William Lee',           NULL,           '2026-07-07'::date, 1900::numeric, 'USD', 'closed_won', 30, 'Email and LinkedIn Outreach',      'N', 'closed_deals', 'closed_deals_row_2'),
  ('Gabriel C',              'Hire-A- Dev',  '2026-06-02'::date, 1000::numeric, 'USD', 'closed_won', 30, 'Email outreach',                   'Y', 'closed_deals', 'closed_deals_row_3'),
  ('Dilu Miah',              'Repsight',     '2026-06-12'::date, 700::numeric,  'USD', 'closed_won', 30, 'Email outreach',                   'N', 'closed_deals', 'closed_deals_row_4'),
  ('James',                  'Black Ford',   '2026-06-06'::date, 1200::numeric, 'USD', 'closed_won', 30, 'Email outreach',                   'Y', 'closed_deals', 'closed_deals_row_5'),
  ('Caleb Sinn',             'Social Bloom', '2026-06-12'::date, 7500::numeric, 'USD', 'closed_won', 30, 'RB Matrix and Mail box Management', 'Y', 'closed_deals', 'closed_deals_row_6'),
  ('David James Christman',  'ShiftNow. IO', '2026-07-09'::date, 2000::numeric, 'USD', 'closed_won', 30, 'Email and LinkedIn Outreach',      'N', 'closed_deals', 'closed_deals_row_7')
) AS v(client_name, company, closed_date, revenue, currency, stage_key, sales_cycle_days, project_type, payment_received, source_sheet, import_key)
WHERE NOT EXISTS (SELECT 1 FROM outreach_opportunities o WHERE o.import_key = v.import_key);

-- 5d. Credits Tracker → outreach_credits_purchases (3 real rows, all GBP)
INSERT INTO outreach_credits_purchases (purchase_date, credits_purchased, amount_paid, currency, import_key)
SELECT * FROM (VALUES
  ('2026-07-06'::date, 300, 42::numeric, 'GBP', 'credits_row_2'),
  ('2026-07-09'::date, 300, 42::numeric, 'GBP', 'credits_row_3'),
  ('2026-07-14'::date, 300, 42::numeric, 'GBP', 'credits_row_4')
) AS v(purchase_date, credits_purchased, amount_paid, currency, import_key)
WHERE NOT EXISTS (SELECT 1 FROM outreach_credits_purchases c WHERE c.import_key = v.import_key);
