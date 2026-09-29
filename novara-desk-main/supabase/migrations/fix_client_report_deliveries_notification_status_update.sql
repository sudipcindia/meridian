-- Fix (found during Client Reports QA, 2026-09-28): add_client_report_deliveries.sql
-- deliberately shipped with NO UPDATE policy at all, so that a Developer-only
-- delete (is_deleted/status/deleted_at/deleted_by, set only via the
-- service-role-powered api/portal/admin-provision.js delete-report action)
-- could never be performed by a direct authenticated-role Supabase call. That
-- also silently blocked the ONE legitimate authenticated-role write this
-- table needs: index.html's submitSendReport() setting
-- notification_status/notification_error right after a successful send.
-- PostgREST doesn't error on an RLS-blocked UPDATE (it just matches zero
-- rows), so this shipped invisibly — caught by QA when a real sent report's
-- notification_status stayed NULL instead of 'sent'/'failed'.
--
-- Fix: `authenticated` already had a full, unconditional table-level UPDATE
-- grant here (Supabase's schema-wide default privilege, confirmed via
-- information_schema.role_table_grants) — RLS was always the only real
-- gate, and "no UPDATE policy" was already correctly blocking everything.
-- Rather than opening a blanket UPDATE policy (which would let any staff
-- member's browser console flip is_deleted/status again), this revokes that
-- default table-level grant and re-grants UPDATE on ONLY the two
-- notification columns, then adds a permissive RLS policy on top. Postgres
-- enforces column-level privileges independently of RLS: an UPDATE
-- statement naming ANY other column (is_deleted, status, deleted_at,
-- deleted_by, title, file_url, ...) is rejected outright for the
-- `authenticated` role, no matter what the RLS policy allows. The
-- service_role used by admin-provision.js's delete-report action is
-- untouched by this (it bypasses RLS and column grants entirely), so
-- Developer-only delete enforcement is unchanged.
revoke update on client_report_deliveries from authenticated;
grant update (notification_status, notification_error) on client_report_deliveries to authenticated;

create policy "auth_update_notification_status" on client_report_deliveries
  for update to authenticated using (true) with check (true);
