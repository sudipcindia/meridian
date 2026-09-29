-- outreach_take_pipeline_snapshot() was flagged by the Supabase security
-- advisor as callable by the anon (unauthenticated) role via PostgREST RPC
-- — it should only be callable by signed-in staff (same trust boundary as
-- every other outreach_* write) or by pg_cron itself (which runs as the DB
-- owner, not through PostgREST, so this grant change doesn't affect the
-- scheduled job).
REVOKE EXECUTE ON FUNCTION outreach_take_pipeline_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION outreach_take_pipeline_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION outreach_take_pipeline_snapshot() TO authenticated;
