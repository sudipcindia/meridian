import type { ProposalData, TranscriptAnalysisFields } from './types.js'

export type AnalysisFieldKind = 'text' | 'textarea' | 'list'

export interface AnalysisFieldDef {
  key: keyof TranscriptAnalysisFields
  label: string
  kind: AnalysisFieldKind
}

export interface AnalysisCardDef {
  title: string
  fields: AnalysisFieldDef[]
}

/**
 * Drives the extracted-information cards on the Proposal AI Analysis page —
 * one data-driven definition instead of 19 hand-written form blocks, so a
 * future extracted field only needs an entry here (plus the corresponding
 * key in TranscriptAnalysisFields/prompts.ts) rather than new JSX.
 * `list` fields are edited as one item per line (see ProposalAiAnalysis.tsx).
 */
export const ANALYSIS_CARDS: AnalysisCardDef[] = [
  {
    title: 'Client & Company',
    fields: [
      { key: 'clientName', label: 'Client Name', kind: 'text' },
      { key: 'firstName', label: 'First Name', kind: 'text' },
      { key: 'lastName', label: 'Last Name', kind: 'text' },
      { key: 'company', label: 'Company', kind: 'text' },
      { key: 'website', label: 'Website', kind: 'text' },
      { key: 'industry', label: 'Industry', kind: 'text' },
      { key: 'location', label: 'Location', kind: 'text' },
      { key: 'businessType', label: 'Business Type', kind: 'text' },
    ],
  },
  {
    title: 'Business Context',
    fields: [
      { key: 'currentSituation', label: 'Current Situation', kind: 'textarea' },
      { key: 'painPoints', label: 'Pain Points', kind: 'list' },
      { key: 'problems', label: 'Problems', kind: 'list' },
      { key: 'goals', label: 'Goals', kind: 'list' },
      { key: 'competition', label: 'Competition', kind: 'textarea' },
      { key: 'currentMarketing', label: 'Current Marketing', kind: 'textarea' },
    ],
  },
  {
    title: 'Services',
    fields: [
      { key: 'servicesRequired', label: 'Services Required', kind: 'list' },
      { key: 'recommendedServices', label: 'Recommended Services', kind: 'list' },
    ],
  },
  {
    title: 'Deal Details',
    fields: [
      { key: 'budget', label: 'Budget (if available)', kind: 'text' },
      { key: 'timeline', label: 'Timeline', kind: 'text' },
      { key: 'decisionMaker', label: 'Decision Maker', kind: 'text' },
    ],
  },
  {
    title: 'Additional Notes',
    fields: [{ key: 'additionalNotes', label: 'Anything Useful', kind: 'textarea' }],
  },
]

// ─── Phase 02: missing-information follow-ups ──────────────────────────────

export interface FollowUpFieldDef {
  key: string
  label: string
  /** Given to Claude so it can tell this key apart from the similarly-named Phase 01 field it must not just duplicate (e.g. mainCompetitor vs. competition). */
  description: string
}

/**
 * The fixed, whitelisted set of details Phase 02 is allowed to ask about —
 * api/ai/find-missing-info.ts drops anything Claude returns outside this
 * list, so a follow-up question can never ask about arbitrary/unexpected
 * information.
 */
export const FOLLOW_UP_FIELD_DEFS: FollowUpFieldDef[] = [
  { key: 'budget', label: 'Budget', description: 'Overall budget for the engagement — only ask if the extracted budget field is empty or too vague to use.' },
  { key: 'targetLocation', label: 'Target Location', description: 'The geographic market/area the client wants to target or grow into — distinct from where the business is currently based.' },
  { key: 'targetAudience', label: 'Target Audience', description: "Who the client's ideal customers are." },
  { key: 'revenueGoal', label: 'Revenue Goal', description: 'A specific revenue target or growth figure, if not already captured among the extracted goals.' },
  { key: 'monthlyMarketingBudget', label: 'Monthly Marketing Budget', description: 'A specific monthly marketing spend figure, if different from the general budget.' },
  { key: 'currentCRM', label: 'Current CRM', description: 'What CRM system, if any, the client currently uses.' },
  { key: 'currentWebsitePlatform', label: 'Current Website Platform', description: "What platform or CMS the client's current website runs on." },
  { key: 'mainCompetitor', label: 'Main Competitor', description: 'Their single biggest named competitor — only ask if the extracted competition field is empty or too vague to use.' },
  { key: 'businessPriority', label: 'Business Priority', description: "The client's single top priority right now." },
]

export const FOLLOW_UP_FIELD_KEYS: string[] = FOLLOW_UP_FIELD_DEFS.map((f) => f.key)

export function getFollowUpFieldLabel(key: string): string {
  return FOLLOW_UP_FIELD_DEFS.find((f) => f.key === key)?.label ?? key
}

// ─── Phase 03: Proposal Data synthesis ─────────────────────────────────────

export interface ProposalDataFieldDef {
  key: keyof ProposalData
  label: string
  kind: AnalysisFieldKind
}

/** Drives the Proposal Data card on the saved-analysis detail page — same one-data-driven-definition approach as ANALYSIS_CARDS. */
export const PROPOSAL_DATA_FIELDS: ProposalDataFieldDef[] = [
  { key: 'clientName', label: 'Client Name', kind: 'text' },
  { key: 'companyName', label: 'Company Name', kind: 'text' },
  { key: 'website', label: 'Website', kind: 'text' },
  { key: 'industry', label: 'Industry', kind: 'text' },
  { key: 'location', label: 'Location', kind: 'text' },
  { key: 'painPoints', label: 'Pain Points', kind: 'list' },
  { key: 'goals', label: 'Goals', kind: 'list' },
  { key: 'services', label: 'Services', kind: 'list' },
  { key: 'pricing', label: 'Pricing', kind: 'textarea' },
  { key: 'recommendation', label: 'Recommendation', kind: 'textarea' },
  { key: 'cta', label: 'Call To Action', kind: 'textarea' },
  { key: 'summary', label: 'Summary', kind: 'textarea' },
]
