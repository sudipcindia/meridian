/**
 * Proposal Intelligence Learning Engine. This is NOT another proposal
 * generator — it teaches the AI how Novara creates winning proposals by
 * capturing ANONYMISED, structural patterns from approved/signed
 * proposals (never verbatim proposal text, never confidential client
 * detail) and by letting staff maintain the prompt building blocks that
 * will inform a FUTURE generation phase. Nothing here modifies the
 * existing AI Proposal Engine (Phases 01-07) — this module is read-only
 * with respect to every existing generation route/prompt.
 */

export const INDUSTRY_TAXONOMY = [
  'Roofing',
  'Construction',
  'Healthcare',
  'Recruitment',
  'Logistics',
  'Manufacturing',
  'Legal',
  'Professional Services',
  'Technology',
  'Retail',
  'Education',
  'Other',
] as const

export type Industry = (typeof INDUSTRY_TAXONOMY)[number]

export type LearningOutcome = 'approved' | 'signed'

export type CtaLengthBucket = 'short' | 'medium' | 'long'

/**
 * A single anonymised learning signal — structural/categorical only.
 * `proposalId` exists purely for idempotent re-capture (one row per
 * proposal) and is never surfaced in aggregate learning insights.
 */
export interface LearningSignal {
  id: string
  proposalId: string
  capturedAt: string
  capturedBy: string
  outcome: LearningOutcome
  industry: Industry
  /** Novara's own service names (e.g. "Website Refresh") — a controlled vocabulary, not client-confidential content. */
  services: string[]
  /** Deterministically derived category tags (e.g. "SEO", "Website Build") — never free client text. */
  strategyTags: string[]
  painPointCount: number
  /** A style descriptor (e.g. "Professional, consultative, outcome-focused") — describes HOW it was written, not WHAT was written about the client. */
  proposalTone: string
  proposalLength: number
  packageCount: number
  ctaLengthBucket: CtaLengthBucket
  ctaHasUrgency: boolean
  confidenceScore: number
}

export type PromptConfigType = 'master' | 'industry' | 'service' | 'style_guide' | 'british_english' | 'sales_psychology'

export const SINGLETON_PROMPT_CONFIG_TYPES: PromptConfigType[] = ['master', 'style_guide', 'british_english', 'sales_psychology']

export interface PromptConfigEntry {
  id: string
  configType: PromptConfigType
  /** Industry name (for 'industry') or a staff-defined service name (for 'service'); '' for singleton types. */
  configKey: string
  content: string
  updatedAt: string
  updatedBy: string
}
