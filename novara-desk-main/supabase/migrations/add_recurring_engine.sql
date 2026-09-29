-- Recurring Roadmap Engine: backward-compatible schema additions
-- Both columns use IF NOT EXISTS + safe defaults so existing plans are untouched.

ALTER TABLE performance_plans
  ADD COLUMN IF NOT EXISTS smart_recurring_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT '{}';

-- smart_recurring_enabled:
--   FALSE (default) = legacy plan, recurring engine never runs
--   TRUE = admin has opted this plan into the recurring roadmap engine

-- service_types:
--   Empty object (default) = use PP_SERVICES default_type per service
--   Override example: { "web": "recurring", "custom_brand": "one_time" }
