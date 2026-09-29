// Vercel Serverless Function — Proposal Intelligence Engine, Phase 03.
// Converts verified Proposal Intelligence (Phases 01-02) into a structured
// Proposal Blueprint — never HTML, never CSS, never a rendered proposal
// page, and never a write to any Proposal Builder table. Every fact
// already confirmed in Proposal Intelligence (client company/industry,
// pain points, goals, challenges, opportunities, competitors, recommended
// services, and every resolved variable) is copied through verbatim here
// in code — Claude is only asked to generate the creative, page-mapped
// narrative built on top of those facts (see
// ../../src/modules/blueprint/prompts.ts). Nothing here is persisted —
// saving is a separate, explicit client action (src/lib/blueprints.ts).
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
// Same key/model/raw-fetch pattern as every other AI route in this app —
// no Anthropic SDK, key never leaves this server-side function.

import {
  buildBlueprintNarrativeSystemPrompt,
  buildBlueprintPageContentASystemPrompt,
  buildBlueprintPageContentBSystemPrompt,
  buildBlueprintUserPrompt,
  buildDynamicPagePlanSystemPrompt,
  buildDynamicPagePlanUserPrompt,
} from '../../src/modules/blueprint/prompts.js'
import { emptyProposalBlueprint, type BlueprintProposalContext, type ProposalBlueprint, type DynamicPagePlan } from '../../src/modules/blueprint/types.js'
import { coerceDynamicPagePlan } from '../../src/modules/blueprint/dynamicPagePlan.js'
import { emptyProposalIntelligence, type ProposalIntelligence } from '../../src/modules/intelligence/types.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'
import type { ProviderIdentity } from '../../src/modules/branding/identity.js'

function sanitizeIntelligenceInput(raw: unknown): ProposalIntelligence {
  const base = emptyProposalIntelligence()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  return {
    ...base,
    ...obj,
    client: { ...base.client, ...(obj.client && typeof obj.client === 'object' ? (obj.client as Record<string, unknown>) : {}) },
    business: { ...base.business, ...(obj.business && typeof obj.business === 'object' ? (obj.business as Record<string, unknown>) : {}) },
  } as ProposalIntelligence
}

function sanitizeProposalContext(raw: unknown): BlueprintProposalContext {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    clientName: str(obj.clientName),
    clientFirstName: str(obj.clientFirstName),
    companyName: str(obj.companyName),
    proposalName: str(obj.proposalName),
    proposalType: str(obj.proposalType),
    preparedBy: str(obj.preparedBy),
    providerIdentity: obj.providerIdentity === 'upwork' ? 'upwork' : 'novara',
  }
}

function coerceStringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

function coerceStringArrayField(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function coerceNestedObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

/** Coerces the narrative/strategy half of the "generated" fields — see coercePageContentFields for the other half. Split into two independent Claude calls (api/ai/generate-blueprint.ts's handler) purely for latency; the merged shape is identical to the single-call version this replaced. */
function coerceNarrativeFields(raw: unknown) {
  const obj = coerceNestedObject(raw)
  const client = coerceNestedObject(obj.client)

  return {
    businessSummary: coerceStringField(client, 'businessSummary'),
    currentSituation: coerceStringField(obj, 'currentSituation'),
    recommendedStrategy: coerceStringField(obj, 'recommendedStrategy'),
    deliverables: coerceStringArrayField(obj, 'deliverables'),
    timeline: coerceStringField(obj, 'timeline'),
    kpis: coerceStringArrayField(obj, 'kpis'),
    pricingStrategy: coerceStringField(obj, 'pricingStrategy'),
    investmentRecommendation: coerceStringField(obj, 'investmentRecommendation'),
    roiOpportunities: coerceStringArrayField(obj, 'roiOpportunities'),
    closingMessage: coerceStringField(obj, 'closingMessage'),
    callToAction: coerceStringField(obj, 'callToAction'),
    proposalTone: coerceStringField(obj, 'proposalTone'),
  }
}

/** Coerces page-content group A (Cover, Business Intro, Challenges, Current Situation) — see coerceNarrativeFields/coercePageContentBFields for the other two groups. */
function coercePageContentAFields(raw: unknown) {
  const obj = coerceNestedObject(raw)
  const pages = coerceNestedObject(obj.pages)
  const page01 = coerceNestedObject(pages.page01)

  return {
    page01: {
      heading: coerceStringField(page01, 'heading'),
      subHeading: coerceStringField(page01, 'subHeading'),
      tags: coerceStringArrayField(page01, 'tags'),
      introduction: coerceStringField(page01, 'introduction'),
    },
    page02: coerceStringField(pages, 'page02'),
    page03: coerceStringField(pages, 'page03'),
    page04: coerceStringField(pages, 'page04'),
  }
}

/** Coerces page-content group B (Recommended Strategy, Roadmap, Why Novara, Investment, Acceptance) — see coerceNarrativeFields/coercePageContentAFields for the other two groups. */
function coercePageContentBFields(raw: unknown) {
  const obj = coerceNestedObject(raw)
  const pages = coerceNestedObject(obj.pages)
  const page08 = coerceNestedObject(pages.page08)
  const page11 = coerceNestedObject(pages.page11)

  return {
    page05: coerceStringField(pages, 'page05'),
    page06: coerceStringField(pages, 'page06'),
    page07: coerceStringField(pages, 'page07'),
    page08: {
      packages: coerceStringArrayField(page08, 'packages'),
      pricingNotes: coerceStringField(page08, 'pricingNotes'),
    },
    page11: {
      acceptanceMessage: coerceStringField(page11, 'acceptanceMessage'),
      envelopeMessage: coerceStringField(page11, 'envelopeMessage'),
    },
  }
}

function coerceGeneratedFields(narrativeRaw: unknown, pageContentARaw: unknown, pageContentBRaw: unknown) {
  return {
    ...coerceNarrativeFields(narrativeRaw),
    ...coercePageContentAFields(pageContentARaw),
    ...coercePageContentBFields(pageContentBRaw),
  }
}

/**
 * Builds the full ProposalBlueprint by combining Claude's creative output
 * with facts that are already known with certainty and must never be
 * re-generated or re-worded: client company/industry, pain points, goals,
 * challenges, opportunities, competitors, recommended services (all
 * copied straight from the verified ProposalIntelligence), and every
 * resolved variable (copied from Proposal metadata + ProposalIntelligence).
 */
function buildBlueprint(
  generated: ReturnType<typeof coerceGeneratedFields>,
  intelligence: ProposalIntelligence,
  proposal: BlueprintProposalContext,
  dynamicPagePlan: DynamicPagePlan
): ProposalBlueprint {
  const blueprint = emptyProposalBlueprint()
  const resolvedClientName = intelligence.client.fullName || proposal.clientName
  const resolvedCompany = intelligence.client.company || proposal.companyName

  blueprint.client = {
    company: resolvedCompany,
    industry: intelligence.client.industry,
    businessSummary: generated.businessSummary,
  }
  blueprint.currentSituation = generated.currentSituation
  blueprint.painPoints = intelligence.painPoints
  blueprint.businessGoals = intelligence.goals
  blueprint.challenges = intelligence.challenges
  blueprint.opportunities = intelligence.opportunities
  blueprint.competitors = intelligence.competitors
  blueprint.recommendedServices = intelligence.recommendedServices
  blueprint.recommendedStrategy = generated.recommendedStrategy
  blueprint.deliverables = generated.deliverables
  blueprint.timeline = generated.timeline
  blueprint.kpis = generated.kpis
  blueprint.pricingStrategy = generated.pricingStrategy
  blueprint.investmentRecommendation = generated.investmentRecommendation
  blueprint.roiOpportunities = generated.roiOpportunities
  blueprint.closingMessage = generated.closingMessage
  blueprint.callToAction = generated.callToAction
  blueprint.proposalTone = generated.proposalTone
  blueprint.urgency = intelligence.urgency
  blueprint.decisionMakers = intelligence.decisionMakers
  blueprint.missingInformation = intelligence.missingInformation
  blueprint.objections = intelligence.objections
  blueprint.budget = intelligence.budget
  blueprint.commercial = intelligence.commercial

  blueprint.pages = {
    page01: generated.page01,
    page02: generated.page02,
    page03: generated.page03,
    page04: generated.page04,
    page05: generated.page05,
    page06: generated.page06,
    page07: generated.page07,
    page08: generated.page08,
    page09: { timeline: generated.timeline, deliverables: generated.deliverables },
    // page10.company/page10.client map onto the frozen template's RIGHT
    // (client-side) signature column only — the left column is Novara's own
    // name, hardcoded directly in ProposalPage10.tsx, never dynamic.
    // Previously this wrote { company: 'Novara Consult', client:
    // resolvedCompany || resolvedClientName }, which put Novara's own name on
    // the client's side of the signature and buried the client's own
    // contact name behind their company name.
    page10: { company: resolvedCompany, client: resolvedClientName },
    page11: { ...generated.page11, closingCTA: generated.callToAction },
  }

  blueprint.variables = {
    clientName: resolvedClientName,
    clientFirstName: intelligence.client.firstName || proposal.clientFirstName,
    clientLastName: intelligence.client.lastName,
    companyName: resolvedCompany,
    proposalName: proposal.proposalName,
    preparedBy: proposal.preparedBy,
    proposalType: proposal.proposalType,
    industry: intelligence.client.industry,
    location: intelligence.client.location,
    website: intelligence.client.website,
    services: intelligence.recommendedServices,
    providerIdentity: proposal.providerIdentity ?? 'novara',
  }

  blueprint.dynamicPagePlan = dynamicPagePlan

  return blueprint
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = req.body as { proposal?: unknown; intelligence?: unknown } | undefined
  if (!body?.intelligence) {
    return res.status(400).json({ error: 'Missing required field: intelligence' })
  }
  const intelligence = sanitizeIntelligenceInput(body.intelligence)
  const proposal = sanitizeProposalContext(body.proposal)
  const identity: ProviderIdentity = proposal.providerIdentity ?? 'novara'

  try {
    // Three smaller, independent calls run concurrently instead of one
    // large one asking for all 26 fields at once. A single call was
    // measured in production taking long enough to hit Vercel's function
    // timeout outright; a first attempt splitting into two halves still
    // did. None of the three groups depends on another's output — all are
    // derived independently from the same verified facts — so this
    // changes nothing about the result's coherence, only how fast each
    // individual completion finishes (wall-clock time ~= the slowest of
    // the three, not their sum). callClaude's own internal timeout
    // (api/_lib/ai/claudeClient.ts) also means a stuck call now fails as a
    // clean, catchable error well before this function's own duration
    // limit, instead of the whole invocation being hard-killed.
    const userPrompt = buildBlueprintUserPrompt(intelligence, proposal)
    const callStart = Date.now()
    // Timed individually and logged even on failure — console.log streams to
    // Vercel's logs in real time, so this survives even if the whole
    // invocation is later hard-killed, unlike a value only known after
    // Promise.all resolves. This is what will show which specific call (if
    // any) is still slow if this ever needs diagnosing again.
    const timed = (label: string, p: Promise<string>) =>
      p
        .then((text) => {
          console.log(`generate-blueprint.ts: ${label} completed in ${Date.now() - callStart}ms`)
          return text
        })
        .catch((e) => {
          console.error(`generate-blueprint.ts: ${label} failed after ${Date.now() - callStart}ms:`, e instanceof Error ? e.message : e)
          throw e
        })
    // Content Architect: a 4th call, deliberately small (no tools, low
    // maxTokens) and independent of the other three — it only decides
    // WHETHER/HOW MANY/WHAT TYPE of extra insight pages this client's
    // facts justify, never drafting their content, so it adds ~zero
    // wall-clock time riding alongside the other three in the same
    // Promise.all rather than after them.
    const dynamicPagePlanUserPrompt = buildDynamicPagePlanUserPrompt(intelligence, proposal)
    const [narrativeText, pageContentAText, pageContentBText, dynamicPagePlanText] = await Promise.all([
      timed(
        'narrative call',
        callClaude({
          apiKey,
          model: 'claude-sonnet-4-6',
          maxTokens: 2048,
          system: buildBlueprintNarrativeSystemPrompt(identity),
          userPrompt,
        })
      ),
      timed(
        'page-content-A call',
        callClaude({
          apiKey,
          model: 'claude-sonnet-4-6',
          maxTokens: 2048,
          system: buildBlueprintPageContentASystemPrompt(identity),
          userPrompt,
        })
      ),
      timed(
        'page-content-B call',
        callClaude({
          apiKey,
          model: 'claude-sonnet-4-6',
          maxTokens: 2048,
          system: buildBlueprintPageContentBSystemPrompt(identity),
          userPrompt,
        })
      ),
      // Unlike the other three (which are core Blueprint content and must
      // fail the whole request if they fail), a failure here degrades to
      // "no extra pages" rather than failing Blueprint generation outright
      // — the dynamic page plan is optional value-add, not core content.
      // `.catch` here (after `timed`'s own logging) turns a rejection into
      // an empty string so this branch alone can never reject the
      // Promise.all; the empty-string case is handled below when parsing.
      timed(
        'dynamic-page-plan call',
        callClaude({
          apiKey,
          model: 'claude-sonnet-4-6',
          maxTokens: 768,
          system: buildDynamicPagePlanSystemPrompt(identity),
          userPrompt: dynamicPagePlanUserPrompt,
        })
      ).catch(() => ''),
    ])

    let narrativeParsed: unknown
    let pageContentAParsed: unknown
    let pageContentBParsed: unknown
    try {
      narrativeParsed = extractJson(narrativeText)
      pageContentAParsed = extractJson(pageContentAText)
      pageContentBParsed = extractJson(pageContentBText)
    } catch (e) {
      console.error('generate-blueprint.ts: failed to parse model response as JSON:', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    // The dynamic page plan is genuinely optional value-add, not core
    // Blueprint content — a parse failure here degrades to "no extra
    // pages" rather than failing the whole Blueprint generation the other
    // three calls already succeeded at.
    let dynamicPagePlanParsed: unknown = null
    try {
      dynamicPagePlanParsed = extractJson(dynamicPagePlanText)
    } catch (e) {
      console.error('generate-blueprint.ts: failed to parse dynamic-page-plan response as JSON, defaulting to no extra pages:', e instanceof Error ? e.message : e)
    }

    const generated = coerceGeneratedFields(narrativeParsed, pageContentAParsed, pageContentBParsed)
    const dynamicPagePlan = coerceDynamicPagePlan(dynamicPagePlanParsed)
    return res.status(200).json({ blueprint: buildBlueprint(generated, intelligence, proposal, dynamicPagePlan) })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('generate-blueprint.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
