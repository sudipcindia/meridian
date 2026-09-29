-- =============================================================
-- Novara Desk — Daily Briefing pg_cron Setup
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- Requires: pg_cron + pg_net extensions enabled in Supabase
--
-- BEFORE RUNNING: Replace the two placeholders below:
--   YOUR_PROJECT_REF  → e.g. lmuaqdtmgnwuuckixtjb
--   YOUR_SERVICE_ROLE_KEY → Supabase Dashboard → Settings → API → service_role key
-- =============================================================

-- Step 1: Enable required extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Remove old job if it exists (safe re-run)
SELECT cron.unschedule('invoke-daily-briefing')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'invoke-daily-briefing'
);

-- Step 3: Create the daily cron job
-- Schedule: 30 5 * * * = 05:30 UTC daily = 06:30 BST / 11:00 IST
SELECT cron.schedule(
  'invoke-daily-briefing',
  '30 5 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-briefing',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body   := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify the job was created:
-- SELECT * FROM cron.job WHERE jobname = 'invoke-daily-briefing';

-- To check recent run history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'invoke-daily-briefing') ORDER BY start_time DESC LIMIT 10;

-- To manually test the function right now (run in SQL Editor):
-- SELECT net.http_post(
--   url    := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-briefing',
--   headers := jsonb_build_object(
--     'Content-Type',  'application/json',
--     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--   ),
--   body   := '{}'::jsonb
-- );
