-- Quick Task upgrade: tickets need a home for the structured data the new
-- Quick Task popup captures (Project, recurring frequency, voice note
-- audio+transcript, Loom attachment+analysis, free-form Notes) without
-- adding five separate narrow columns or a parallel "quick task" table.
-- Purely additive — existing rows default to an empty object, nothing else
-- on the table changes, and every existing reader of `tickets` is unaffected
-- since nothing previously read this column.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS quick_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
