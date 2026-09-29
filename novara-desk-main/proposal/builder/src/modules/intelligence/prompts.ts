/**
 * Prompt-building for the Proposal Intelligence Engine — the ONE place this
 * logic lives, mirroring the same pattern already used by modules/ai/
 * prompts.ts and modules/analysis/prompts.ts for their own, separate flows.
 *
 * The system prompt's entire job is to constrain Claude to a single,
 * complete analysis pass: no follow-up questions (a later phase), no
 * proposal pages, no HTML, no Markdown — just one JSON object matching
 * ProposalIntelligence, with empty values where the transcript doesn't
 * say. api/ai/analyze-meeting.ts still defensively re-validates and
 * coerces the parsed result server-side — this prompt reduces how often
 * that fallback path is needed, it isn't the only safeguard.
 */

import { NOVARA_ANALYST_PERSONA, NO_FABRICATION_RULE, NEVER_GUESS_OR_OMIT_KEY, JSON_OBJECT_RESPONSE_ONLY } from '../ai/promptFragments.js'

const SCHEMA_FIELDS: string[] = [
  'client (object) — { firstName, lastName, fullName, company, email, website, industry, businessType, companySize, location } — all strings, "" if not mentioned. email must be left "" unless an actual email address was explicitly stated — never invent or guess one.',
  'business (object) — { currentSituation, currentMarketing, currentWebsite, existingCRM, existingAds, existingSEO } — all strings, "" if not mentioned',
  'commercial (object) — { packageDetails, deposit, paymentTerms, contractDuration, recommendedPackage, optionalServices, guarantees } — all strings, "" if not mentioned. packageDetails should summarise how many packages/tiers were discussed, their names, prices, and whether each is one-time or monthly. Sales/discovery meetings very rarely cover commercial terms in detail — leaving these "" when genuinely not discussed is expected and correct, not a failure.',
  'goals (string[]) — outcomes the client said they want',
  'painPoints (string[]) — problems or frustrations the client described',
  'challenges (string[]) — obstacles in the way of achieving their goals, distinct from general pain points',
  'objections (string[]) — hesitations, concerns, or pushback the client raised',
  'urgency (string) — how urgent this is to the client, in their own terms, else ""',
  'timeline (string) — any deadline or timeframe mentioned, else ""',
  'competitors (string[]) — competitors or alternatives the client mentioned',
  'decisionMakers (string[]) — who the client said is involved in or makes the final decision',
  'recommendedServices (string[]) — services that plausibly fit the stated goals/pain points; grounded in the transcript, never a sales pitch or proposal copy',
  'budget (string) — any budget figure or range mentioned, else ""',
  'opportunities (string[]) — growth or improvement opportunities implied by the conversation, distinct from goals the client stated outright',
  'missingInformation (string[]) — important details this analysis could not determine from the transcript (e.g. "Budget not discussed") — a list of gaps, not questions to ask',
  'confidenceScore (number) — 0-100, your own confidence that this analysis accurately reflects what was actually said',
]

export function buildIntelligenceSystemPrompt(): string {
  return [
    NOVARA_ANALYST_PERSONA,
    'You will be given the transcript of a sales or discovery meeting with a prospective client (it may have been extracted from a plain text file, a Word document, a PDF, or pasted meeting notes — treat it as plain text regardless of its original source).',
    `Your ONLY job is to fully understand this meeting and extract structured business intelligence that is stated or clearly implied. ${NO_FABRICATION_RULE}`,
    'Do NOT ask any follow-up questions. Do NOT list questions to ask the client. First and only perform a complete analysis of what is already in the transcript — asking clarifying questions is a separate, later step you are not part of.',
    'You must NOT generate proposal pages, sections, or copy of any kind. You must NOT output HTML. You must NOT output Markdown. You must NOT output anything except the one JSON object described below.',
    JSON_OBJECT_RESPONSE_ONLY,
    'Write any extracted text in British English.',
    `The JSON object must have exactly these top-level keys:\n${SCHEMA_FIELDS.map((f) => `- ${f}`).join('\n')}`,
    `For any field with no information in the transcript, use an empty string "" (for string fields), an empty array [] (for string[] fields), or 0 (for confidenceScore only if the transcript is essentially unusable) — ${NEVER_GUESS_OR_OMIT_KEY}`,
  ].join('\n\n')
}

export function buildIntelligenceUserPrompt(transcript: string): string {
  return [
    'Meeting transcript:',
    '"""',
    transcript,
    '"""',
    'Analyse this meeting now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}
