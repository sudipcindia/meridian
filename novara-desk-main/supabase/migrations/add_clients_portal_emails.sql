-- Multiple Client Portal login emails per client (2026-09).
-- Purely additive: a new nullable-by-default jsonb column, defaulting to an
-- empty array for every existing row. clients.contact_email (the existing
-- "primary" email) is completely untouched — this column only ever holds
-- SECONDARY candidate emails a client can independently register a Client
-- Portal login for, managed from the Client Edit modal.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_emails jsonb NOT NULL DEFAULT '[]'::jsonb;
