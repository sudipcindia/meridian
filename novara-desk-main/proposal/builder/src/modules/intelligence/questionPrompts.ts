/**
 * Prompt-building for Phase 02 — Smart Follow-up Questions. Input is the
 * already-saved ProposalIntelligence object (not the raw transcript) —
 * Claude's only job here is to spot genuine gaps in that object and ask
 * the fewest possible questions to fill them. api/ai/generate-questions.ts
 * still defensively re-validates and drops any question whose field
 * already has a value or isn't one of the fields listed below — this
 * prompt reduces how often that fallback is needed, it isn't the only
 * safeguard.
 */

import type { ProposalIntelligence } from './types.js'
import { NOVARA_ANALYST_PERSONA } from '../ai/promptFragments.js'

const FIELD_GUIDE: string[] = [
  'client.fullName — Business category: the client\'s full name',
  'client.company — Business category: the client\'s company name',
  'client.email — Business category: the client\'s email address',
  'client.website — Business category: their website URL',
  'client.companySize — Business category: company size (e.g. employee count)',
  'client.location — Business category: target locations / where they operate',
  'client.industry — Business category: their industry',
  'client.businessType — Business category: B2B, B2C, etc.',
  'business.currentMarketing — Marketing category: their current marketing activity / analytics in use',
  'business.currentWebsite — Business category: detail on their current website',
  'business.existingCRM — Marketing category: what CRM (if any) they currently use',
  'business.existingAds — Marketing category: whether/what paid ads (e.g. Google Ads) they currently run',
  'business.existingSEO — Marketing category: their current SEO activity',
  'business.currentSituation — Business category: their current situation generally',
  'budget — Sales category: budget figure or range',
  'timeline — Sales category: when they want to start or finish',
  'urgency — Sales category: how urgent this is to them',
  'decisionMakers — Sales category: who makes the final decision',
  'competitors — Business category: competitors or alternatives they mentioned',
  'recommendedServices — Proposal category: preferred package / preferred services',
  'goals — Proposal category: success KPIs / what success looks like to them',
  'painPoints — Business category: problems or frustrations',
  'challenges — Business category: obstacles in their way',
  'objections — Sales category: hesitations or concerns',
  'opportunities — Proposal category: growth or improvement opportunities',
  'commercial.packageDetails — Commercial category: how many packages/tiers are being offered, their names, their prices, and whether each is one-time or monthly — meeting transcripts almost never cover this, so it is very often genuinely missing',
  'commercial.deposit — Commercial category: any deposit or upfront payment required',
  'commercial.paymentTerms — Commercial category: payment schedule/terms (e.g. monthly in advance, net 30)',
  'commercial.contractDuration — Commercial category: minimum contract length or term',
  'commercial.recommendedPackage — Commercial category: which package/tier is being recommended as the best fit for this client',
  'commercial.optionalServices — Commercial category: any optional add-on services available beyond the core packages',
  'commercial.guarantees — Commercial category: any guarantees or performance commitments being offered',
]

export function buildQuestionsSystemPrompt(): string {
  return [
    NOVARA_ANALYST_PERSONA,
    'You will be given a structured Proposal Intelligence object — the result of an earlier analysis of a client meeting. Some fields may already be filled in; others may be empty because the transcript never covered them.',
    'Your ONLY job is to identify genuinely MISSING or UNCERTAIN information and generate the minimum number of follow-up questions needed to fill those specific gaps. Speed matters more than completeness — never produce a long questionnaire.',
    'Target 5 to 10 questions. Never exceed 10. If very little is missing, return fewer questions — even none.',
    'NEVER ask about a field that already has a non-empty value in the object below — that information is already confirmed.',
    'NEVER ask two questions about the same field (no duplicates).',
    'Every question must target exactly one of the following fields — do not invent new fields:',
    FIELD_GUIDE.map((f) => `- ${f}`).join('\n'),
    'For each question, choose the answerType that best fits what is being asked:',
    '- short_text: a brief factual answer (e.g. website URL, industry)',
    '- paragraph: a longer free-text answer (e.g. current situation, pain points)',
    '- number: a plain numeric answer (e.g. employee count)',
    '- currency: a monetary amount (e.g. budget)',
    '- date: a specific date or deadline (only if a precise date makes sense, not a vague timeframe)',
    '- dropdown: one choice from a short list of common options you provide (e.g. company size bands)',
    '- multi_select: multiple choices from a short list you provide (e.g. preferred services)',
    '- yes_no: a simple yes/no fact (e.g. whether they already use a CRM)',
    'When answerType is "dropdown" or "multi_select", include an "options" array of 3-6 short, sensible string choices. Omit "options" (or leave it empty) for every other answerType.',
    'category must be exactly one of: "business", "marketing", "sales", "proposal", "commercial" — matching the category noted next to each field above.',
    'Respond with ONLY a single valid JSON array — no markdown code fences, no commentary, no explanation, no surrounding text of any kind. If there is nothing genuinely missing, respond with an empty array [].',
    'Each array element must be an object with exactly these keys: "category", "question", "answerType", "options", "targetField".',
    'Write each question in British English, phrased naturally, as a single concise sentence.',
  ].join('\n\n')
}

export function buildQuestionsUserPrompt(intelligence: ProposalIntelligence): string {
  return [
    'Proposal Intelligence object (JSON):',
    '"""',
    JSON.stringify(intelligence, null, 2),
    '"""',
    'Generate the follow-up questions now, following the exact rules and JSON schema from the system prompt. Respond with the JSON array only.',
  ].join('\n')
}
