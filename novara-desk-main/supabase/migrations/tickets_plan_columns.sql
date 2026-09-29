-- Add plan-tracking columns to tickets table
-- Safe to re-run (ADD COLUMN IF NOT EXISTS)
-- Run once in Supabase SQL Editor → Table Editor → SQL

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS week_number integer,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_tickets_source  ON public.tickets(source);
CREATE INDEX IF NOT EXISTS idx_tickets_plan_id ON public.tickets(plan_id);
