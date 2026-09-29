-- ============================================================================
-- Proposal Acceptance: IP-based geolocation (audit trail)
-- ============================================================================
-- Coarse, city-level location derived from the request's source IP —
-- sourced from Vercel's own automatic request geolocation headers
-- (x-vercel-ip-country / -country-region / -city / -timezone), which cost
-- nothing extra and require no third-party geolocation service. This is
-- deliberately never GPS-precise — IP geolocation is inherently
-- approximate (city/region level at best), which matches the explicit
-- requirement to avoid precise location tracking.
--
-- geo_timezone here is IP-inferred, distinct from browser_timezone (added
-- in add_proposal_acceptance_device_context.sql), which is self-reported
-- by the signer's own browser — the two can legitimately disagree (e.g. a
-- VPN, or a traveller signing from an unfamiliar network) and both are
-- kept as separate, honestly-labelled facts rather than merged into one.
--
-- All nullable: these headers are only present on real Vercel deployments,
-- never in local dev — existing and locally-tested rows simply have NULL.
--
-- Safe to run multiple times (idempotent). No existing rows are touched.
-- ============================================================================

ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS geo_country text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS geo_region text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS geo_city text;
ALTER TABLE proposal_builder_acceptances ADD COLUMN IF NOT EXISTS geo_timezone text;
