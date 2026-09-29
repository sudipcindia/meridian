/**
 * Prompt-building for transcript analysis — the ONE place this logic lives,
 * mirroring how ../ai/prompts.ts is the sole prompt-builder for proposal
 * section content (a separate, unrelated flow this module never touches).
 *
 * The system prompt's entire job is to constrain Claude to extraction only:
 * no proposal pages, no HTML, no Markdown, no CSS — just one JSON object
 * matching TranscriptAnalysisFields, with empty values where the transcript
 * doesn't say. api/ai/analyze-transcript.ts still defensively re-validates
 * and coerces the parsed result server-side — this prompt reduces how often
 * that fallback path is needed, it isn't the only safeguard.
 */

import { FOLLOW_UP_FIELD_DEFS } from './fields.js'
import type { FollowUpAnswers, TranscriptAnalysisFields } from './types.js'
import { NOVARA_ANALYST_PERSONA, NO_FABRICATION_RULE, NEVER_GUESS_OR_OMIT_KEY, JSON_OBJECT_RESPONSE_ONLY } from '../ai/promptFragments.js'

const SCHEMA_FIELDS: string[] = [
  'clientName (string) — the client\'s full name, if mentioned',
  'firstName (string)',
  'lastName (string)',
  'company (string) — company/organisation name',
  'website (string)',
  'industry (string)',
  'location (string) — city, region, or country',
  'businessType (string) — e.g. B2B, B2C, e-commerce, agency, local service, etc.',
  'servicesRequired (string[]) — services the client explicitly asked about or requested',
  'painPoints (string[]) — problems or frustrations the client described',
  'goals (string[]) — outcomes the client said they want',
  'problems (string[]) — concrete issues/blockers mentioned, distinct from general pain points',
  'currentSituation (string) — a short, factual summary of where the client is today',
  'competition (string) — competitors or alternatives the client mentioned',
  'budget (string) — any budget figure or range mentioned, else ""',
  'timeline (string) — any deadline or timeframe mentioned',
  'decisionMaker (string) — who the client said makes the final decision',
  'currentMarketing (string) — the client\'s current marketing activity or channels, if mentioned',
  'recommendedServices (string[]) — services that plausibly fit the stated pain points/goals; brief, grounded in the transcript, never a sales pitch or proposal content',
  'additionalNotes (string) — any other useful business detail that does not fit the fields above',
]

export function buildAnalysisSystemPrompt(): string {
  return [
    NOVARA_ANALYST_PERSONA,
    'You will be given the transcript of a sales or discovery call with a prospective client.',
    `Your ONLY job is to extract structured business information that is stated or clearly implied in the transcript. ${NO_FABRICATION_RULE}`,
    'You must NOT generate proposal pages, sections, or copy. You must NOT output HTML. You must NOT output Markdown. You must NOT output CSS. You must NOT output anything except the one JSON object described below.',
    JSON_OBJECT_RESPONSE_ONLY,
    'Write any extracted text in British English.',
    `The JSON object must have exactly these keys:\n${SCHEMA_FIELDS.map((f) => `- ${f}`).join('\n')}`,
    `For any field with no information in the transcript, use an empty string "" (for string fields) or an empty array [] (for string[] fields) — ${NEVER_GUESS_OR_OMIT_KEY}`,
  ].join('\n\n')
}

export function buildAnalysisUserPrompt(transcript: string): string {
  return [
    'Meeting transcript:',
    '"""',
    transcript,
    '"""',
    'Extract the structured information now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}

// ─── Phase 02: missing-information follow-ups ──────────────────────────────

export function buildMissingInfoSystemPrompt(): string {
  return [
    NOVARA_ANALYST_PERSONA,
    'You will be given business information already extracted from a sales/discovery call, plus any follow-up answers already collected from staff.',
    'Your ONLY job is to identify which items from a fixed list of business details are still genuinely missing, and phrase one short, clear, natural follow-up question for each missing item, in British English.',
    'A detail counts as already known if it is clearly present in the extracted information OR already present in the existing answers provided — never ask about it again in that case. Never ask two questions about the same detail.',
    'You must NOT generate proposal pages, sections, or copy. You must NOT output HTML. You must NOT output Markdown. You must NOT output CSS. You must NOT output anything except the JSON array described below.',
    `The fixed list of details you may ask about (never ask about anything outside this list):\n${FOLLOW_UP_FIELD_DEFS.map((f) => `- ${f.key}: ${f.description}`).join('\n')}`,
    'Respond with ONLY a single valid JSON array — no markdown code fences, no commentary, no explanation, no preamble, no surrounding text of any kind.',
    'Each array item must be an object with exactly two keys: "key" (one of the exact keys listed above) and "question" (a short, natural follow-up question for a Novara staff member to ask the client).',
    'Only include an item for a detail that is genuinely missing. If nothing is missing, respond with an empty array: []',
  ].join('\n\n')
}

export function buildMissingInfoUserPrompt(analysis: TranscriptAnalysisFields, existingAnswers: FollowUpAnswers): string {
  return [
    'Extracted business information (from the original transcript analysis):',
    JSON.stringify(analysis, null, 2),
    'Follow-up answers already collected (never ask about any of these keys again):',
    JSON.stringify(existingAnswers, null, 2),
    'Identify genuinely missing details now, following the exact rules from the system prompt. Respond with the JSON array only.',
  ].join('\n\n')
}

// ─── Phase 03: Proposal Data synthesis ─────────────────────────────────────

const PROPOSAL_DATA_SCHEMA_FIELDS: string[] = [
  'clientName (string)',
  'companyName (string)',
  'website (string)',
  'industry (string)',
  'location (string)',
  'painPoints (string[])',
  'goals (string[])',
  'services (string[]) — recommended services based on the given information',
  'pricing (string) — a short, plain, factual summary of budget/pricing considerations, based only on what is known',
  'recommendation (string) — a short, grounded recommendation of approach, 2-3 sentences',
  'cta (string) — a short, natural call to action for next steps',
  'summary (string) — a brief overall summary of the client\'s situation and opportunity, 2-4 sentences',
]

export function buildProposalDataSystemPrompt(): string {
  return [
    NOVARA_ANALYST_PERSONA,
    'You will be given: the original meeting transcript, structured business information already extracted from it, and any follow-up answers already collected.',
    'Your ONLY job is to consolidate all of this into ONE clean, structured "Proposal Data" JSON object — factual client/business information plus a short, grounded services/pricing/recommendation summary suitable for later use in a proposal. You are NOT writing a proposal.',
    'You must NOT generate proposal pages, sections, or copy. You must NOT output HTML. You must NOT output Markdown. You must NOT output CSS. You must NOT output anything except the one JSON object described below.',
    'Base every field only on the information given — never invent facts not present in the transcript, analysis, or answers. Grounded synthesis is expected for pricing/recommendation/cta/summary (a short, natural business summary), but it must stay factual and directly traceable to the given inputs, never creative or promotional copy.',
    'Write all text in British English.',
    `The JSON object must have exactly these keys:\n${PROPOSAL_DATA_SCHEMA_FIELDS.map((f) => `- ${f}`).join('\n')}`,
    'For any field with no information available, use an empty string "" (for string fields) or an empty array [] (for string[] fields) — never fabricate, and never omit a key.',
    JSON_OBJECT_RESPONSE_ONLY,
  ].join('\n\n')
}

export function buildProposalDataUserPrompt(transcript: string, analysis: TranscriptAnalysisFields, followUpAnswers: FollowUpAnswers): string {
  return [
    'Meeting transcript:',
    '"""',
    transcript,
    '"""',
    'Extracted business information:',
    JSON.stringify(analysis, null, 2),
    'Follow-up answers collected:',
    JSON.stringify(followUpAnswers, null, 2),
    'Consolidate this into the Proposal Data JSON object now, following the exact schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n\n')
}
