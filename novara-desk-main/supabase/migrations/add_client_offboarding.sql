-- Client Offboarding System
-- Adds reversible offboarding state to clients table.
-- No data is deleted; offboarded clients are hidden from dashboards at the JS layer.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS offboarded_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS offboarded_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pre_offboard_status TEXT;
