-- Phase 7 (2026-09-10): give outreach_opportunities a real, safe path to
-- clients.id. Previously there was none — only free-text client_name/company
-- — which is why the Client Portal's GTM leads section (Phase 6) could not
-- safely show individual leads per client.
--
-- Nullable by design: outreach_opportunities is the sales PIPELINE table —
-- most rows are pre-sale prospects that are not (and may never become) a
-- real client. Existing rows are intentionally left NULL; no backfill was
-- performed, since no non-guessed, non-name-based signal exists anywhere in
-- the current data to connect a historical opportunity to a specific
-- clients.id row (verified directly against live data before writing this
-- migration — see docs/database-map.md and docs/development-log.md for the
-- full investigation). Going forward, staff explicitly link an opportunity
-- to a real client via the Outreach module's "Link to existing client"
-- field (index.html, otrOppFormHtml/otrSaveOpp) — a human decision, not an
-- automated guess.
ALTER TABLE outreach_opportunities
  ADD COLUMN client_id text NULL REFERENCES clients(id);

CREATE INDEX idx_outreach_opportunities_client_id ON outreach_opportunities(client_id);
