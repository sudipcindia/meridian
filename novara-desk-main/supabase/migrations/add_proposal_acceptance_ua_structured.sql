-- ============================================================================
-- Proposal Acceptance: structured browser/OS/device fields (audit trail)
-- ============================================================================
-- `user_agent` has always been stored raw, and browser/OS were only ever
-- derived from it at DISPLAY time (src/lib/acceptances.ts's parseUserAgent)
-- — a small regex that produces a string like "Chrome on macOS" with no
-- version and no device-type classification, recomputed on every page
-- view rather than stored. For a legal audit trail this isn't enough: an
-- exact browser version and a real desktop/mobile/tablet classification
-- are part of what a client dispute needs to be answered against.
--
-- These columns are filled once, server-side, at accept time (see
-- api/client/accept.ts + the new api/_lib/useragent/parseUserAgent.ts),
-- alongside the raw user_agent column, which is never dropped — it stays
-- the ground truth if the parser is ever wrong or extended later.
--
-- All nullable, no backfill: the 2 existing acceptance rows predate
-- structured parsing and simply have NULL here. The UI falls back to the
-- existing display-time parseUserAgent() for exactly those legacy rows —
-- never a guess presented as a stored fact.
--
-- Safe to run multiple times (idempotent). No existing rows are touched.
-- ============================================================================

ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS browser_name text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS browser_version text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS os_name text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS os_version text;
-- 'desktop' | 'mobile' | 'tablet' | 'unknown' — not a DB-level CHECK
-- constraint, since this is a best-effort classification derived from a
-- user-controllable header (User-Agent), not a value the app itself
-- chooses from a fixed set the way e.g. signature_method is.
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS device_type text;
