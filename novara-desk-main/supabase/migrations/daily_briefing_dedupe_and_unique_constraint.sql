-- Fix (2026-09 Daily Briefing audit): every member was receiving the "Your
-- Daily Briefing" email twice per day. Root cause: pg_net's client-side
-- timeout (5000ms, unset/default) is far shorter than this function's real
-- runtime (multiple minutes for 17 members), and net._http_response showed
-- "Timeout of 5000 ms reached" with no status code for the day's single
-- queued request. The platform still delivered the request at least once
-- more while the first run was in-flight, so the same pg_cron firing reached
-- the function twice. The function's existing duplicate check (a SELECT of
-- already-sent emails, fetched once at the top of the run) can't catch two
-- concurrent runs racing each other, since both read the same "not yet sent"
-- snapshot before either has written anything back.
--
-- This migration makes duplicate-send protection atomic and server-side,
-- keyed on the deterministic pair the function already writes on every run:
-- member_email + run_date. Historical rows already contain 202 duplicate
-- log entries (mostly the recent daily double-sends, plus a handful of
-- multi-attempt rows from this function's original development/testing on
-- 2026-05-06) that would violate a new uniqueness constraint, so they are
-- deduplicated first -- for each (run_date, member_email) group, the row
-- kept is the one with status='sent' if one exists (the actual outcome that
-- reached the member's inbox), otherwise the earliest row. This only removes
-- redundant rows in this operational send-log table; it does not touch any
-- client, ticket, or plan data, and does not un-send any email that was
-- already delivered.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY run_date, member_email
      ORDER BY (status = 'sent') DESC, created_at ASC
    ) AS rn
  FROM daily_briefing_log
)
DELETE FROM daily_briefing_log
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- One row per member per day, period. The edge function now claims this slot
-- with a single INSERT before doing any Claude/Resend work; a concurrent or
-- redelivered invocation loses the race with a unique-violation and skips
-- immediately, so at most one email can ever be sent per member per date.
ALTER TABLE public.daily_briefing_log
  ADD CONSTRAINT daily_briefing_log_member_date_uniq UNIQUE (member_email, run_date);
