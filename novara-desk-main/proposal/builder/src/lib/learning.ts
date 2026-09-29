import { supabase } from './supabaseClient.js'
import type { Industry, LearningOutcome, LearningSignal, PromptConfigEntry, PromptConfigType } from '../modules/learning/index.js'

const SIGNALS_TABLE = 'proposal_learning_signals'
const CONFIG_TABLE = 'ai_prompt_configuration'

interface LearningSignalRow {
  id: string
  proposal_id: string
  captured_at: string
  captured_by: string
  outcome: string
  industry: string
  services: string[]
  strategy_tags: string[]
  pain_point_count: number
  proposal_tone: string
  proposal_length: number
  package_count: number
  cta_length_bucket: string
  cta_has_urgency: boolean
  confidence_score: number
}

function fromSignalRow(row: LearningSignalRow): LearningSignal {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    capturedAt: row.captured_at,
    capturedBy: row.captured_by,
    outcome: row.outcome as LearningOutcome,
    industry: row.industry as Industry,
    services: row.services ?? [],
    strategyTags: row.strategy_tags ?? [],
    painPointCount: row.pain_point_count,
    proposalTone: row.proposal_tone,
    proposalLength: row.proposal_length,
    packageCount: row.package_count,
    ctaLengthBucket: row.cta_length_bucket as LearningSignal['ctaLengthBucket'],
    ctaHasUrgency: row.cta_has_urgency,
    confidenceScore: row.confidence_score,
  }
}

/**
 * Records one anonymised learning signal for a proposal — upserts on
 * proposal_id, so re-capturing (e.g. after a revision) updates the same
 * row rather than double-counting. Never writes to any Proposal Builder
 * table; this is a fully isolated, read-only-with-respect-to-generation
 * record.
 */
export async function captureLearningSignal(
  proposalId: string,
  signal: Omit<LearningSignal, 'id' | 'proposalId' | 'capturedAt' | 'capturedBy'>
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(SIGNALS_TABLE).upsert(
    {
      proposal_id: proposalId,
      captured_by: userData.user?.email ?? '',
      outcome: signal.outcome,
      industry: signal.industry,
      services: signal.services,
      strategy_tags: signal.strategyTags,
      pain_point_count: signal.painPointCount,
      proposal_tone: signal.proposalTone,
      proposal_length: signal.proposalLength,
      package_count: signal.packageCount,
      cta_length_bucket: signal.ctaLengthBucket,
      cta_has_urgency: signal.ctaHasUrgency,
      confidence_score: signal.confidenceScore,
      captured_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id' }
  )

  if (error) throw new Error(error.message)
}

export async function isSignalCaptured(proposalId: string): Promise<boolean> {
  const { data, error } = await supabase.from(SIGNALS_TABLE).select('id').eq('proposal_id', proposalId).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

/** Aggregate insights only — never joined back to client-identifying proposal metadata in the UI. */
export async function listLearningSignals(): Promise<LearningSignal[]> {
  const { data, error } = await supabase.from(SIGNALS_TABLE).select('*').order('captured_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as LearningSignalRow[]).map(fromSignalRow)
}

interface PromptConfigRow {
  id: string
  config_type: string
  config_key: string
  content: string
  updated_at: string
  updated_by: string
}

function fromConfigRow(row: PromptConfigRow): PromptConfigEntry {
  return {
    id: row.id,
    configType: row.config_type as PromptConfigType,
    configKey: row.config_key,
    content: row.content,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export async function listPromptConfig(): Promise<PromptConfigEntry[]> {
  const { data, error } = await supabase.from(CONFIG_TABLE).select('*').order('config_type').order('config_key')
  if (error) throw new Error(error.message)
  return (data as PromptConfigRow[]).map(fromConfigRow)
}

/**
 * One row per (configType, configKey) — upserts on that pair, so saving
 * an existing entry (e.g. the Technology industry prompt) updates it in
 * place. This becomes the central AI configuration surface for a future
 * generation phase to read; no existing generation route reads it today.
 */
export async function savePromptConfigEntry(configType: PromptConfigType, configKey: string, content: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(CONFIG_TABLE).upsert(
    {
      config_type: configType,
      config_key: configKey,
      content,
      updated_by: userData.user?.email ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'config_type,config_key' }
  )

  if (error) throw new Error(error.message)
}

export async function deletePromptConfigEntry(configType: PromptConfigType, configKey: string): Promise<void> {
  const { error } = await supabase.from(CONFIG_TABLE).delete().eq('config_type', configType).eq('config_key', configKey)
  if (error) throw new Error(error.message)
}
