-- Client Portal two-way ticket communication: tracks when the client last
-- viewed a given ticket, so the portal's ticket list can show a genuine
-- "new update" indicator (a staff comm posted after this timestamp) without
-- a separate read-tracking table. Purely additive — nullable, no default
-- needed beyond NULL (meaning "never viewed", which correctly shows as
-- unread the first time a ticket has any staff activity).
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS client_last_viewed_at timestamptz;
