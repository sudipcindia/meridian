-- ============================================================================
-- Proposal Acceptance: browser-reported device context (audit trail)
-- ============================================================================
-- Screen resolution, viewport size, preferred language, and the signer's
-- own browser-reported timezone (distinct from geo_timezone, which is
-- inferred from IP in a later migration) — none of this existed before.
-- Captured client-side (src/lib/deviceContext.ts) immediately before
-- submission and re-validated server-side (api/client/accept.ts), same
-- "never trust the client, but the client is still the only source" posture
-- as every other field on this table. All optional: a browser that can't
-- provide one of these just omits it — nothing here blocks signing.
--
-- All nullable, no backfill: existing acceptance rows predate this capture
-- and simply have NULL here — the UI shows "Not recorded", never a guess.
--
-- Safe to run multiple times (idempotent). No existing rows are touched.
-- ============================================================================

ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS screen_resolution text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS viewport_size text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS browser_timezone text;
