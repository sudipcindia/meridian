/**
 * Prompt-building for Phase 03 — Proposal Blueprint. Claude is deliberately
 * asked for a SMALLER schema than the full ProposalBlueprint object: every
 * fact already captured and user-verified in Proposal Intelligence (Phases
 * 01-02) — company, industry, pain points, goals, challenges,
 * opportunities, competitors, recommended services, and every resolved
 * variable — is copied through verbatim by api/ai/generate-blueprint.ts,
 * never re-generated or re-worded by the model. Claude's only job is the
 * genuinely creative part: turning those verified facts into consultative,
 * page-mapped proposal narrative. This keeps the Blueprint faithful to
 * what the user actually confirmed, and keeps the prompt/response small.
 *
 * That "generated" subset is split into THREE independent groups —
 * narrative/strategy fields, and page-mapped content split into two
 * halves — issued as three smaller, parallel Claude calls (see
 * api/ai/generate-blueprint.ts) rather than one large one. A single call
 * for all 26 fields was measured in production taking long enough to hit
 * Vercel's function timeout outright; a first attempt splitting into two
 * halves still did. None of the three groups depends on another's output
 * (all are derived independently from the same verified facts), so this
 * changes nothing about the result's coherence, only how fast each
 * individual completion finishes.
 */

import type { ProposalIntelligence } from '../intelligence/index.js'
import type { BlueprintProposalContext } from './types.js'
import { JSON_OBJECT_RESPONSE_ONLY } from '../ai/promptFragments.js'
import { ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS } from '../salesContent/prompts.js'
import { getProviderName, getVoiceGuidance, type ProviderIdentity } from '../branding/identity.js'

const NARRATIVE_SCHEMA_FIELDS: string[] = [
  'client.businessSummary (string) — a concise, specific executive summary of this client\'s business, grounded only in the facts provided',
  'currentSituation (string) — a consultative synthesis of their current marketing/website/CRM/ads/SEO situation, pain-first',
  'recommendedStrategy (string) — the strategic approach recommended for this specific client, outcome-focused',
  'deliverables (string[]) — concrete workstreams/outputs this engagement will deliver',
  'timeline (string) — a proposed phased timeline narrative for delivering the recommended strategy',
  'kpis (string[]) — measurable success metrics appropriate to this client\'s stated goals',
  'pricingStrategy (string) — the reasoning for how this engagement should be priced/packaged, value-driven not generic',
  'investmentRecommendation (string) — a clear, executive-level recommendation on what to invest and why',
  'roiOpportunities (string[]) — specific return-on-investment angles for this client, distinct from the general opportunities already on file',
  'closingMessage (string) — a short, confident closing message for the proposal',
  'callToAction (string) — a single, direct call to action',
  'proposalTone (string) — a one-line description of the tone used (e.g. "Professional, consultative, outcome-focused")',
]

const PAGE_CONTENT_A_SCHEMA_FIELDS: string[] = [
  'pages.page01.heading (string) — the Cover page\'s main heading',
  'pages.page01.subHeading (string) — the Cover page\'s sub-heading',
  'pages.page01.tags (string[]) — 3-5 short capability tags for the Cover page',
  'pages.page01.introduction (string) — a short Cover page introduction',
  'pages.page02 (string) — Page 02, Business Introduction: prepared content for this page',
  'pages.page03 (string) — Page 03, Client Challenges: prepared content for this page',
  'pages.page04 (string) — Page 04, Current Situation: prepared content for this page',
]

function pageContentBSchemaFields(identity: ProviderIdentity): string[] {
  return [
    'pages.page05 (string) — Page 05, Recommended Strategy: prepared content for this page',
    'pages.page06 (string) — Page 06, Implementation Roadmap: prepared content for this page',
    `pages.page07 (string) — Page 07, Why ${getProviderName(identity)}: prepared content for this page`,
    'pages.page08.packages (string[]) — recommended package names/tiers for the Investment page',
    'pages.page08.pricingNotes (string) — supporting notes for the Investment page',
    'pages.page11.acceptanceMessage (string) — a short message framing what the client is accepting',
    'pages.page11.envelopeMessage (string) — a short, personal message to accompany the sent proposal',
  ]
}

function buildSharedPreamble(schemaFields: string[], identity: ProviderIdentity = 'novara'): string {
  const providerName = getProviderName(identity)
  const lines = [
    `You are a senior proposal strategist working for ${providerName}${identity === 'novara' ? ', a UK growth consultancy' : ''}.`,
    `You will be given structured Proposal Intelligence — verified facts about a prospective client, already confirmed by a ${providerName} team member. Treat every fact in it as ground truth; do not contradict or second-guess it.`,
    'Your ONLY job is to convert these verified facts into structured, page-mapped proposal narrative — the "brain" of the proposal, not the proposal itself.',
    'You must NOT generate a full proposal page, HTML, CSS, or Markdown of any kind. You must NOT output anything except the one JSON object described below.',
    'Everything you write must be specific to THIS client and THIS meeting — grounded in the facts provided. Never generate generic marketing text, filler, or content that could apply to any client.',
    'Write in British English. Content must be: professional, consultative, outcome-focused, pain-first (name the problem before the solution), value-driven, and executive-level in tone.',
    'Keep every field brief — one to three sentences at most, never a full paragraph or more than what a real proposal page would show. Do not pad or elaborate beyond what is asked for; concise beats thorough here.',
    JSON_OBJECT_RESPONSE_ONLY,
    `The JSON object must have exactly these fields (nested as shown):\n${schemaFields.map((f) => `- ${f}`).join('\n')}`,
    'Never omit a key. Use a short, sensible default only if the underlying facts genuinely give you nothing to work with — never fabricate a fact that was not provided.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildBlueprintNarrativeSystemPrompt(identity: ProviderIdentity = 'novara'): string {
  return buildSharedPreamble(NARRATIVE_SCHEMA_FIELDS, identity)
}

export function buildBlueprintPageContentASystemPrompt(identity: ProviderIdentity = 'novara'): string {
  return buildSharedPreamble(PAGE_CONTENT_A_SCHEMA_FIELDS, identity)
}

export function buildBlueprintPageContentBSystemPrompt(identity: ProviderIdentity = 'novara'): string {
  return buildSharedPreamble(pageContentBSchemaFields(identity), identity)
}

export function buildBlueprintUserPrompt(intelligence: ProposalIntelligence, proposal: BlueprintProposalContext): string {
  return [
    'Proposal metadata (JSON):',
    '"""',
    JSON.stringify(proposal, null, 2),
    '"""',
    'Verified Proposal Intelligence (JSON):',
    '"""',
    JSON.stringify(intelligence, null, 2),
    '"""',
    'Generate the Proposal Blueprint content now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}

/**
 * "Content Architect" — the 4th parallel call in api/ai/generate-blueprint.ts.
 * Decides ONLY whether this client's verified facts justify additional
 * AI-generated insight pages beyond the fixed 11-page template (and if so,
 * how many + which layout + what title) — it never drafts the pages'
 * actual content, which stays a separate, later, per-page call (see
 * salesContent/prompts.ts's per-page generation, wired in the auto-flow).
 * Kept deliberately small/cheap/tool-free, matching every other call in
 * this file — a single oversized call is the one pattern that has
 * repeatedly caused production timeouts in this codebase.
 */
export function buildDynamicPagePlanSystemPrompt(identity: ProviderIdentity = 'novara'): string {
  const providerName = getProviderName(identity)
  const lines = [
    `You are a senior proposal strategist working for ${providerName}${identity === 'novara' ? ', a UK growth consultancy' : ''}, acting as the "Content Architect" for this proposal.`,
    `The proposal already has a fixed 11-page core template (Cover, Business Introduction, Client Challenges, Current Situation, Recommended Strategy, Implementation Roadmap, Why ${providerName}, Investment, Timeline, Signatures, Acceptance). Your ONLY job is deciding whether THIS client's verified facts justify additional visual insight pages beyond that fixed template — inserted after Page 07 — and if so, exactly how many and what type. You are not writing any proposal content here.`,
    'You may plan between 0 and 8 additional pages. Most real proposals need 2-4. A client with sparse, generic, or thin verified facts should get FEWER pages, even 0 — this is a valid, often-correct outcome, never something to avoid. Padding the count to look thorough actively hurts the proposal\'s credibility and is a worse outcome than a short, honest plan.',
    'Each page you plan must use exactly one of the following visual layouts, and must earn its place with a genuinely distinct angle on this client\'s business — never plan the same layout twice, and never plan a page that just repeats ground the fixed template or another planned page already covers:',
    Object.entries(ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS)
      .map(([layout, fragment]) => `- ${layout}: ${fragment}`)
      .join('\n'),
    JSON_OBJECT_RESPONSE_ONLY,
    'The JSON object must have exactly this shape: { "pages": [ { "layout": one of the layout names above (string), "title": a short, specific, real page title for THIS client\'s proposal — never generic or templated (string), "rationale": one sentence, internal-only — this is never shown to the client, so be honest about exactly why this page earns its place rather than persuasive (string) } ] }.',
    'If nothing in the verified facts justifies any additional page, return { "pages": [] } exactly — do not invent a page just to avoid an empty array.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildDynamicPagePlanUserPrompt(intelligence: ProposalIntelligence, proposal: BlueprintProposalContext): string {
  return [
    'Proposal metadata (JSON):',
    '"""',
    JSON.stringify(proposal, null, 2),
    '"""',
    'Verified Proposal Intelligence (JSON):',
    '"""',
    JSON.stringify(intelligence, null, 2),
    '"""',
    'Decide the dynamic page plan now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}
