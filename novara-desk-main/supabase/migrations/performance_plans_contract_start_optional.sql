-- Fix (2026-09 Plan Builder update): Contract Start must become optional per
-- product requirement, but contract_start was NOT NULL at the DB level, so
-- even a client-side-permitted blank submission would fail at insert time.
-- Only 2 plans exist today, both with real dates already -- no data affected.
ALTER TABLE public.performance_plans ALTER COLUMN contract_start DROP NOT NULL;
