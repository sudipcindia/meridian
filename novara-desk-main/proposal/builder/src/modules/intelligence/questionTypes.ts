import type { ProposalIntelligence } from './types.js'

/**
 * Proposal Intelligence Engine — Phase 02: Smart Follow-up Questions.
 * Every question targets exactly one field already defined on
 * ProposalIntelligence (types.ts) — this phase never invents new fields,
 * it only fills gaps in the object Phase 01 produced.
 */
export type QuestionCategory = 'business' | 'marketing' | 'sales' | 'proposal' | 'commercial'

export type QuestionAnswerType = 'short_text' | 'paragraph' | 'number' | 'currency' | 'date' | 'dropdown' | 'multi_select' | 'yes_no'

export const INTELLIGENCE_TARGET_FIELDS = [
  'client.fullName',
  'client.company',
  'client.email',
  'client.website',
  'client.companySize',
  'client.location',
  'client.industry',
  'client.businessType',
  'business.currentMarketing',
  'business.currentWebsite',
  'business.existingCRM',
  'business.existingAds',
  'business.existingSEO',
  'business.currentSituation',
  'budget',
  'timeline',
  'urgency',
  'decisionMakers',
  'competitors',
  'recommendedServices',
  'goals',
  'painPoints',
  'challenges',
  'objections',
  'opportunities',
  'commercial.packageDetails',
  'commercial.deposit',
  'commercial.paymentTerms',
  'commercial.contractDuration',
  'commercial.recommendedPackage',
  'commercial.optionalServices',
  'commercial.guarantees',
] as const

export type IntelligenceTargetField = (typeof INTELLIGENCE_TARGET_FIELDS)[number]

/**
 * The fields the rest of the system actually depends on — enforced as
 * non-skippable in the Meeting Transcript auto-flow's Smart Questions step
 * (see modules/intelligence/essentials.ts), unlike every other target field
 * which stays freely skippable. The commercial.* fields are essential
 * because Page 08 cannot be generated at all without them — transcripts
 * almost never cover pricing, so these routinely surface as questions even
 * when every other essential was extracted cleanly.
 */
export const ESSENTIAL_TARGET_FIELDS: { field: IntelligenceTargetField; label: string }[] = [
  { field: 'client.fullName', label: 'Client Name' },
  { field: 'client.company', label: 'Company Name' },
  { field: 'client.email', label: 'Client Email' },
  { field: 'commercial.packageDetails', label: 'Package Details' },
  { field: 'commercial.deposit', label: 'Deposit' },
  { field: 'commercial.paymentTerms', label: 'Payment Terms' },
  { field: 'commercial.contractDuration', label: 'Contract Duration' },
  { field: 'commercial.recommendedPackage', label: 'Recommended Package' },
]

/**
 * Essential only in a specific circumstance, unlike ESSENTIAL_TARGET_FIELDS
 * above which is unconditional. Page 07's research step (see
 * salesContent/prompts.ts's WEB_RESEARCH_RULE) can analyse a client's own
 * website when one exists; without a website, industry and business type
 * are the only things it has left to search by at all — so those two
 * fields must be explicitly confirmed rather than left to chance the way
 * they normally are for a client who does have a site.
 */
export const CONDITIONAL_ESSENTIAL_TARGET_FIELDS: {
  field: IntelligenceTargetField
  label: string
  requiredIf: (intelligence: ProposalIntelligence) => boolean
}[] = [
  { field: 'client.industry', label: 'Industry', requiredIf: (i) => !i.client.website.trim() },
  { field: 'client.businessType', label: 'Business Type', requiredIf: (i) => !i.client.website.trim() },
]

const ARRAY_TARGET_FIELDS = new Set<IntelligenceTargetField>([
  'decisionMakers',
  'competitors',
  'recommendedServices',
  'goals',
  'painPoints',
  'challenges',
  'objections',
  'opportunities',
])

/** Whether this target field is one of ProposalIntelligence's string[] fields (vs. a plain string field). */
export function isArrayTargetField(field: IntelligenceTargetField): boolean {
  return ARRAY_TARGET_FIELDS.has(field)
}

/** True if this field already has a confirmed, non-empty value — such a field must never be asked about again. */
export function intelligenceFieldHasValue(intelligence: ProposalIntelligence, field: IntelligenceTargetField): boolean {
  if (field.startsWith('client.')) {
    const key = field.slice('client.'.length) as keyof ProposalIntelligence['client']
    return Boolean(intelligence.client[key]?.trim())
  }
  if (field.startsWith('business.')) {
    const key = field.slice('business.'.length) as keyof ProposalIntelligence['business']
    return Boolean(intelligence.business[key]?.trim())
  }
  if (field.startsWith('commercial.')) {
    const key = field.slice('commercial.'.length) as keyof ProposalIntelligence['commercial']
    return Boolean(intelligence.commercial[key]?.trim())
  }
  const value = (intelligence as unknown as Record<string, unknown>)[field]
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

export interface GeneratedQuestion {
  id: string
  category: QuestionCategory
  question: string
  answerType: QuestionAnswerType
  /** Only meaningful for 'dropdown' and 'multi_select'. */
  options: string[]
  targetField: IntelligenceTargetField
}

export type AnswerValue = string | string[]

export interface QuestionsProgress {
  questions: GeneratedQuestion[]
  answers: Record<string, AnswerValue>
  /** Question ids the user explicitly skipped — distinct from "not yet reached". */
  skipped: string[]
  currentIndex: number
  completedAt: string | null
}

export function emptyQuestionsProgress(): QuestionsProgress {
  return { questions: [], answers: {}, skipped: [], currentIndex: 0, completedAt: null }
}

export interface GenerateQuestionsRequest {
  intelligence: ProposalIntelligence
}

export interface GenerateQuestionsResponse {
  questions: GeneratedQuestion[]
}
