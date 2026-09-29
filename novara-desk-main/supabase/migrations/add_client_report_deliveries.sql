-- Client Reports — manual PDF/URL report delivery to a client, with a
-- permanent send history and Client Portal publishing (2026-09-28).
--
-- Deliberately a NEW, separate table from the existing `reports` table.
-- Clients → [client] → Reports already reads/writes `reports`, but that
-- table is the internal AI-generated narrative/chart performance-report
-- module (type/summary/sections/chart_data/period_start/period_end) — a
-- different feature with a different shape (title+PDF-or-URL+send audit).
-- This migration is purely additive: nothing about `reports` (schema or
-- data) is touched, read, or altered here or by the feature built on it.
--
-- One row per SEND — a row is only ever inserted, never updated to hold a
-- "current" version, so sending the same report again always creates a NEW
-- row rather than overwriting the previous one. This single table shape
-- doubles as both:
--   1. the permanent audit/history list on the internal Reports tab
--      (every row, including soft-deleted ones, so a Developer's delete is
--      itself visible as history rather than erasing the fact it happened)
--   2. the set of "published" reports shown in the Client Portal, which
--      only ever reads is_deleted = false rows (api/portal/reports.js)
--
-- client_id and sent_by are plain text with no FK — the same loose
-- coupling the existing `reports` table already uses for the identical
-- columns, so a later client/team-member change can never be blocked by
-- this table.
--
-- Delete is soft-only (is_deleted/deleted_at/deleted_by) — a row is never
-- actually removed, so "permanent history record" holds even after a
-- Developer deletes it from the Portal/active view. There is deliberately
-- NO UPDATE and NO DELETE policy for `authenticated` below: normal staff
-- cannot flip is_deleted via a direct Supabase call no matter what the UI
-- does. The only path that can ever set it is api/portal/admin-provision.js's
-- delete-report action, which uses the service-role key (bypasses RLS
-- entirely) and independently re-checks department = 'Developer' in code
-- before doing so. Hiding the Delete button for non-Developers in
-- index.html is defense in depth on top of that, never the real
-- enforcement.
create table if not exists client_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  title text not null,
  description text,
  report_type text not null default 'pdf' check (report_type in ('pdf','url')),
  file_url text,
  external_url text,
  sent_by text,
  sent_by_name text,
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent','deleted')),
  notification_status text,
  notification_error text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  check (
    (report_type = 'pdf' and file_url is not null) or
    (report_type = 'url' and external_url is not null)
  )
);

create index if not exists idx_client_report_deliveries_client
  on client_report_deliveries (client_id, sent_at desc);

alter table client_report_deliveries enable row level security;

-- Staff (internal desk app) can read every report for every client and
-- create new sends — the same "any authenticated staff member" tier
-- already used for ticket_comms_read_state/app_settings/most internal
-- tables ("Any authorised Meridian member can create/upload/send" per
-- spec). Intentionally no UPDATE or DELETE policy at all — see above.
create policy "auth_read" on client_report_deliveries
  for select to authenticated using (true);

create policy "auth_insert" on client_report_deliveries
  for insert to authenticated with check (true);

-- PDF files themselves reuse the existing "report-uploads" storage bucket
-- (already public-read / authenticated-write per
-- harden_remaining_storage_bucket_policies.sql) under a distinct
-- "client-reports/<client_id>/..." path prefix — no new bucket, no new
-- storage policy needed.
