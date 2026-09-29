import type { Proposal } from '../../types/proposal.js'
import {
  ESSENTIAL_TARGET_FIELDS,
  CONDITIONAL_ESSENTIAL_TARGET_FIELDS,
  intelligenceFieldHasValue,
  type GeneratedQuestion,
  type IntelligenceTargetField,
  type QuestionCategory,
} from './questionTypes.js'
import type { ProposalIntelligence } from './types.js'

/**
 * Only client.* essentials have an equivalent column on the live Proposal
 * row (a Manual Builder proposal already has real values there even when
 * its ProposalIntelligence is entirely empty) — commercial.* essentials
 * have no such fallback, they only ever come from ProposalIntelligence.
 */
const PROPOSAL_ROW_FALLBACK: Partial<Record<IntelligenceTargetField, (p: Proposal) => string>> = {
  'client.fullName': (p) => p.clientName,
  'client.company': (p) => p.companyName,
  'client.email': (p) => p.clientEmail,
}

/**
 * Real, LLM-independent enforcement of the Meeting Transcript auto-flow's
 * essentials gate. Client Name/Company/Email are the fields Builder
 * population and Send Proposal depend on; the commercial.* fields are what
 * Page 08 generation depends on — transcripts almost never cover pricing,
 * so these routinely surface as questions even when Claude extracted
 * everything else cleanly. Completion never relies on Claude having thought
 * to ask about any of them. Also folds in CONDITIONAL_ESSENTIAL_TARGET_FIELDS
 * (currently: industry/business type when there's no website to research
 * instead) — same enforcement, just scoped to when their `requiredIf` holds.
 */
export function getMissingEssentials(
  proposal: Proposal,
  intelligence: ProposalIntelligence
): { field: IntelligenceTargetField; label: string }[] {
  const missingUnconditional = ESSENTIAL_TARGET_FIELDS.filter(({ field }) => {
    const fromProposal = PROPOSAL_ROW_FALLBACK[field]?.(proposal)
    if (fromProposal?.trim()) return false
    return !intelligenceFieldHasValue(intelligence, field)
  })

  const missingConditional = CONDITIONAL_ESSENTIAL_TARGET_FIELDS.filter(
    ({ field, requiredIf }) => requiredIf(intelligence) && !intelligenceFieldHasValue(intelligence, field)
  )

  return [...missingUnconditional, ...missingConditional]
}

const ESSENTIAL_QUESTION_CATEGORY: Record<string, QuestionCategory> = {
  client: 'business',
  commercial: 'commercial',
}

/** Fields whose answer is naturally multi-sentence — the synthesized fallback should offer a textarea, not a single-line input. */
const PARAGRAPH_ESSENTIAL_FIELDS = new Set<IntelligenceTargetField>(['commercial.packageDetails'])

/** Guarantees an essential field is always askable even if Claude's own generated questions didn't cover it. */
export function synthesizeEssentialQuestion(field: IntelligenceTargetField, label: string): GeneratedQuestion {
  const namespace = field.split('.')[0]
  return {
    id: `essential_${field}`,
    category: ESSENTIAL_QUESTION_CATEGORY[namespace] ?? 'business',
    question: `What is the ${label.toLowerCase()}?`,
    answerType: PARAGRAPH_ESSENTIAL_FIELDS.has(field) ? 'paragraph' : 'short_text',
    options: [],
    targetField: field,
  }
}
