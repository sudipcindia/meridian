-- Safe Team Reassignment — 2026-06-09
-- 1. Sharmila Zahra → Operations (new member, must run add_sharmila_zahra_operations.sql first)
-- 2. Sahil Jaswani → Outreach (department transfer)
-- 3. Rupankita Bhattacharya → Social Media (Ops Intel visibility fix: Design not in DEPTS)
-- 4. Active ticket assignees/owner: Sahil → Sharmila
-- Does NOT touch: standup history, comments, deleted tickets, audit logs, plan promises

-- ── Audit log table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migration_audit_log (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  migrated_at    timestamptz DEFAULT now(),
  action         text NOT NULL,
  previous_owner text,
  new_owner      text,
  affected_table text,
  affected_count integer DEFAULT 0,
  notes          text
);

-- ── Department changes ───────────────────────────────────────────────────────
UPDATE team_members SET department = 'Outreach'     WHERE email = 'sjaswani@novaraconsult.co.uk';
UPDATE team_members SET department = 'Social Media' WHERE email = 'rbhattacharya@novaraconsult.co.uk';

-- ── Ticket reassignment: Sahil → Sharmila (active tickets only) ──────────────
DO $$
DECLARE
  sahil_id        text;
  sharmila_id     text;
  reassigned_count integer;
  owner_count      integer;
BEGIN
  SELECT id INTO sahil_id    FROM team_members WHERE email = 'sjaswani@novaraconsult.co.uk';
  SELECT id INTO sharmila_id FROM team_members WHERE email = 'szahra@novaraconsult.co.uk';

  IF sahil_id IS NULL THEN
    RAISE EXCEPTION 'Sahil Jaswani not found in team_members';
  END IF;
  IF sharmila_id IS NULL THEN
    RAISE EXCEPTION 'Sharmila Zahra not found — run add_sharmila_zahra_operations.sql first';
  END IF;

  -- Replace Sahil in assignees[] (jsonb array column)
  UPDATE tickets
  SET assignees = (
    SELECT jsonb_agg(
      CASE WHEN elem = to_jsonb(sahil_id) THEN to_jsonb(sharmila_id) ELSE elem END
    )
    FROM jsonb_array_elements(assignees) AS elem
  )
  WHERE assignees @> jsonb_build_array(sahil_id)
    AND (is_deleted IS NULL OR is_deleted = false);

  GET DIAGNOSTICS reassigned_count = ROW_COUNT;

  -- Replace Sahil as ticket owner
  UPDATE tickets
  SET owner = sharmila_id
  WHERE owner = sahil_id
    AND (is_deleted IS NULL OR is_deleted = false);

  GET DIAGNOSTICS owner_count = ROW_COUNT;

  -- ── Audit records ─────────────────────────────────────────────────────────
  INSERT INTO migration_audit_log (action, previous_owner, new_owner, affected_table, affected_count, notes)
  VALUES
    ('DEPT_CHANGE',    'Sahil Jaswani (Operations)',              'Sahil Jaswani (Outreach)',              'team_members', 1,                'Role transfer — joining Outreach alongside Adarsh Mishra'),
    ('DEPT_CHANGE',    'Rupankita Bhattacharya (Design)',         'Rupankita Bhattacharya (Social Media)',  'team_members', 1,                'Ops Intel fix — Design was not in DEPTS array'),
    ('TICKET_REASSIGN','Sahil Jaswani',                           'Sharmila Zahra',                        'tickets',       reassigned_count, 'Active ticket assignees[] reassigned'),
    ('OWNER_REASSIGN', 'Sahil Jaswani',                           'Sharmila Zahra',                        'tickets',       owner_count,      'Active ticket owner field reassigned');

END $$;
