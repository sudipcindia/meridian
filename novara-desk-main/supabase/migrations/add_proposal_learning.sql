-- ============================================================================
-- Proposal Intelligence Learning Engine (additive)
-- ============================================================================
-- Two completely new, isolated tables. Neither touches, alters, or reads
-- any proposal_builder_* table beyond a read-only foreign key, and
-- neither is read by any existing AI generation route (analyze-meeting,
-- generate-questions, generate-blueprint, generate-content,
-- generate-impact) — those files, and every other part of the existing
-- AI Proposal Engine, are completely unmodified by this phase. This is a
-- foundational capture + configuration layer only; nothing here is wired
-- into proposal generation.
--
-- 1. proposal_learning_signals — ANONYMISED, structural learning signals
--    captured only when a staff member explicitly marks a won/approved
--    proposal for learning (never automatic, never tied to a status-
--    change trigger). Deliberately holds no verbatim proposal text —
--    only counts, categorical tags, and short style descriptors (e.g.
--    "Professional, consultative, outcome-focused" describes HOW
--    something was written, not WHAT was written about the client).
--    One record per proposal (UNIQUE on proposal_id) — re-capturing
--    updates the same row rather than double-counting.
--
-- 2. ai_prompt_configuration — admin-maintained prompt building blocks
--    (Master Prompt, Industry Prompts, Service Prompts, Style Guide,
--    British English Rules, Sales Psychology Rules). This becomes a
--    central configuration surface for a FUTURE phase to consume; it is
--    intentionally not read by any existing generation route today.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_learning_signals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id           uuid NOT NULL REFERENCES proposal_builder_proposals(id) ON DELETE CASCADE,

  captured_at           timestamptz NOT NULL DEFAULT now(),
  captured_by           text NOT NULL DEFAULT '',

  outcome               text NOT NULL DEFAULT '',
  industry              text NOT NULL DEFAULT '',
  services              jsonb NOT NULL DEFAULT '[]'::jsonb,
  strategy_tags         jsonb NOT NULL DEFAULT '[]'::jsonb,
  pain_point_count      integer NOT NULL DEFAULT 0,
  proposal_tone         text NOT NULL DEFAULT '',
  proposal_length       integer NOT NULL DEFAULT 0,
  package_count         integer NOT NULL DEFAULT 0,
  cta_length_bucket     text NOT NULL DEFAULT '',
  cta_has_urgency       boolean NOT NULL DEFAULT false,
  confidence_score      integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_proposal_learning_signals_proposal
  ON proposal_learning_signals (proposal_id);

ALTER TABLE proposal_learning_signals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_learning_signals' AND policyname = 'proposal_learning_signals_staff_access'
  ) THEN
    CREATE POLICY proposal_learning_signals_staff_access ON proposal_learning_signals
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS ai_prompt_configuration (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  config_type   text NOT NULL,
  config_key    text NOT NULL DEFAULT '',
  content       text NOT NULL DEFAULT '',

  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_prompt_configuration_type_key
  ON ai_prompt_configuration (config_type, config_key);

ALTER TABLE ai_prompt_configuration ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_prompt_configuration' AND policyname = 'ai_prompt_configuration_staff_access'
  ) THEN
    CREATE POLICY ai_prompt_configuration_staff_access ON ai_prompt_configuration
      FOR ALL TO authenticated
      USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))
      WITH CHECK (auth.jwt()->>'email' IN (SELECT email FROM team_members));
  END IF;
END$$;
