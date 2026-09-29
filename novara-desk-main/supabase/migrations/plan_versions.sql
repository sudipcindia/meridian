-- Plan Version History — adds plan_versions JSONB column to performance_plans
-- Safe to re-run (ADD COLUMN IF NOT EXISTS)
-- Run once in Supabase SQL Editor before deploying index.html

ALTER TABLE public.performance_plans
  ADD COLUMN IF NOT EXISTS plan_versions jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.performance_plans.plan_versions IS
  'Array of up to 20 version snapshots: [{id,created_at,created_by,change_type,change_label,plan_snapshot,services_snapshot}]';
