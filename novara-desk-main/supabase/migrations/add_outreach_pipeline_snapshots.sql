-- ══ OUTREACH MODULE — PHASE 5: PIPELINE SNAPSHOTS ══
-- Fixes the Monthly Summary flaw identified in the functional analysis
-- (§3.5, §4): the source workbook's "Active Deals" / "Active Pipeline
-- Value" columns point at Sales Pipeline's CURRENT live totals for every
-- month row, including future months — Excel has no way to snapshot
-- historical state, so every month showed today's pipeline, not that
-- month's. This migration adds a real point-in-time snapshot table plus an
-- automated daily job (pg_cron, already enabled on this project) that
-- captures genuine history going forward. Historical months before this
-- migration legitimately have no snapshot data — the UI must show that
-- honestly rather than backfilling a fabricated number.

CREATE TABLE IF NOT EXISTS outreach_pipeline_snapshots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date      date NOT NULL,
  stage_key          text NOT NULL REFERENCES outreach_stages(key),
  opportunity_count  integer NOT NULL DEFAULT 0,
  pipeline_value     numeric NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, stage_key)
);

CREATE INDEX IF NOT EXISTS idx_outreach_snapshots_date ON outreach_pipeline_snapshots(snapshot_date DESC);

ALTER TABLE outreach_pipeline_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outreach_pipeline_snapshots' AND policyname='auth_rw_outreach_pipeline_snapshots'
  ) THEN
    CREATE POLICY "auth_rw_outreach_pipeline_snapshots" ON outreach_pipeline_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Snapshot function — idempotent per day (ON CONFLICT DO UPDATE), so a
-- manual trigger and the scheduled job both firing the same day just
-- refreshes that day's numbers rather than duplicating rows.
CREATE OR REPLACE FUNCTION outreach_take_pipeline_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO outreach_pipeline_snapshots (snapshot_date, stage_key, opportunity_count, pipeline_value)
  SELECT CURRENT_DATE, o.stage_key, COUNT(*), COALESCE(SUM(COALESCE(o.expected_revenue, o.proposal_value, 0)), 0)
  FROM outreach_opportunities o
  GROUP BY o.stage_key
  ON CONFLICT (snapshot_date, stage_key) DO UPDATE SET
    opportunity_count = EXCLUDED.opportunity_count,
    pipeline_value = EXCLUDED.pipeline_value;
END;
$$;

-- Daily automated snapshot at 23:55 UTC — captures each day's end-of-day
-- pipeline state. Safe to re-run: unschedules any existing job of the same
-- name first, so this migration can be applied more than once.
SELECT cron.unschedule('outreach-daily-pipeline-snapshot')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outreach-daily-pipeline-snapshot');

SELECT cron.schedule(
  'outreach-daily-pipeline-snapshot',
  '55 23 * * *',
  $$SELECT outreach_take_pipeline_snapshot();$$
);

-- Backfill today's snapshot immediately, so real data exists from the
-- moment this ships rather than only starting after tonight's cron run.
SELECT outreach_take_pipeline_snapshot();
