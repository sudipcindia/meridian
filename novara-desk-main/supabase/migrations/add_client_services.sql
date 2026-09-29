-- Master Client Directory: add a "services" field to clients so a client can
-- carry multiple service tags (Sales/Outreach, GTM, SEO, PPC, Social Media,
-- Web Dev, Email Campaign, Content) without needing a separate join table or
-- a duplicate per-department client record. Purely additive — existing rows
-- default to an empty array, nothing else on the table changes.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb;
