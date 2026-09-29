// Vercel Serverless Function — Proposal Intelligence Engine, Phase 05.
// Turns a verified Proposal Blueprint (Phase 03) into persuasive,
// page-mapped proposal COPY — never HTML, never CSS, never a rendered
// page, never a write to any Proposal Builder table. Nothing here is
// persisted — saving is a separate, explicit client action
// (src/lib/salesContent.ts).
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
// Same key/model/raw-fetch pattern as every other AI route in this app —
// no Anthropic SDK, key never leaves this server-side function.

import {
  buildContentSystemPromptCompact,
  buildContentSystemPromptPages0708,
  buildContentSystemPromptPagesInsights,
  buildContentUserPrompt,
  buildContentSystemPromptForPage,
  buildContentUserPromptForPage,
  buildContentSystemPromptForDynamicPage,
} from '../../src/modules/salesContent/prompts.js'
import { emptyProposalContent, type ProposalContent, type ProposalContentPages, type ProposalContentPricingCard, type ProposalContentDynamicInsightPage, type Page07BlockLayout } from '../../src/modules/salesContent/types.js'
import { fitToConstraint } from '../../src/modules/salesContent/templateConstraints.js'
import { coerceEnrichmentBlocks, coerceScore0to10, BLOCK_LAYOUTS } from '../../src/modules/salesContent/enrichmentBlocks.js'
import { emptyProposalBlueprint, type BlueprintProposalContext, type ProposalBlueprint } from '../../src/modules/blueprint/types.js'
import { buildDynamicPagePlanSystemPrompt, buildDynamicPagePlanUserPrompt } from '../../src/modules/blueprint/prompts.js'
import { coerceDynamicPagePlan } from '../../src/modules/blueprint/dynamicPagePlan.js'
import { emptyProposalIntelligence, type ProposalIntelligence } from '../../src/modules/intelligence/types.js'
import { DEFAULT_PAGE08_CARDS } from '../../src/modules/variables/page08Fields.js'
import { makeCollectionId } from '../../src/modules/variables/collections.js'
import { DYNAMIC_INSIGHT_PAGE_IDS, type DynamicInsightPageId } from '../../src/masterTemplate/index.js'
import { AUTO_GENERATE_PAGE_ORDER, type AutoGeneratePageId } from '../../src/modules/blueprintPopulate/index.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError, type AnthropicTool } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'
import type { ProviderIdentity } from '../../src/modules/branding/identity.js'

// Page 07 only (see buildContentSystemPromptForPage's WEB_RESEARCH_RULE,
// which instructs Claude on exactly when/how to use this). Anthropic
// executes the tool server-side within the same request — no round-trip
// needed here, but a single call can now involve several sequential
// searches, so it gets a longer timeout below than every other page.
const WEB_SEARCH_TOOL: AnthropicTool = { type: 'web_search_20250305', name: 'web_search', max_uses: 4 }

function sanitizeBlueprintInput(raw: unknown): ProposalBlueprint {
  const base = emptyProposalBlueprint()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  return { ...base, ...obj } as ProposalBlueprint
}

function sanitizeIntelligenceInput(raw: unknown): ProposalIntelligence {
  const base = emptyProposalIntelligence()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  return {
    ...base,
    ...obj,
    client: { ...base.client, ...(obj.client && typeof obj.client === 'object' ? (obj.client as Record<string, unknown>) : {}) },
    business: { ...base.business, ...(obj.business && typeof obj.business === 'object' ? (obj.business as Record<string, unknown>) : {}) },
    commercial: { ...base.commercial, ...(obj.commercial && typeof obj.commercial === 'object' ? (obj.commercial as Record<string, unknown>) : {}) },
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

function coerceNestedObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

function coerceStringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

function coerceStringArrayField(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** Same as coerceStringField, but also runs the deterministic length safety net (templateConstraints.ts) for the given constraint key before the text ever reaches the template. */
function coerceFittedStringField(obj: Record<string, unknown>, key: string, constraintKey: string): string {
  return fitToConstraint(constraintKey, coerceStringField(obj, key))
}

function coerceFittedStringArrayField(obj: Record<string, unknown>, key: string, constraintKey: string): string[] {
  return coerceStringArrayField(obj, key).map((v) => fitToConstraint(constraintKey, v))
}

/** Coerces Claude's `cards` array into real pricing cards, always assigning a fresh id (Claude is explicitly told not to invent ids — recommended/complementary cards are referenced by array index instead, see coerceCardIndex). Pads from DEFAULT_PAGE08_CARDS if fewer than 2 valid cards come back — the frozen template's combination box structurally requires two packages to combine, so this floor is enforced here rather than trusted to the prompt alone. */
function coerceCardsArray(page08: Record<string, unknown>): ProposalContentPricingCard[] {
  const rawList = Array.isArray(page08.cards) ? page08.cards : []
  const cards: ProposalContentPricingCard[] = rawList
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({
      id: makeCollectionId(),
      title: fitToConstraint('page08.card.title', coerceStringField(c, 'title')),
      price: fitToConstraint('page08.card.price', coerceStringField(c, 'price')),
      priceSuffix: fitToConstraint('page08.card.priceSuffix', coerceStringField(c, 'priceSuffix')),
      whyRecommended: fitToConstraint('page08.card.whyRecommended', coerceStringField(c, 'whyRecommended')),
      features: coerceStringArrayField(c, 'features').map((f) => fitToConstraint('page08.card.feature', f)),
      expectedOutcome: fitToConstraint('page08.card.expectedOutcome', coerceStringField(c, 'expectedOutcome')),
      roiNote: fitToConstraint('page08.card.roiNote', coerceStringField(c, 'roiNote')),
      footerNote: fitToConstraint('page08.card.footerNote', coerceStringField(c, 'footerNote')),
    }))
    .filter((c) => c.title.trim().length > 0)

  for (const fallback of DEFAULT_PAGE08_CARDS) {
    if (cards.length >= 2) break
    cards.push({ ...fallback, id: makeCollectionId() })
  }
  return cards
}

/** Translates Claude's 0-based card index (never a fabricated id) into a safe, in-range index, falling back when missing/invalid/out of range. */
function coerceCardIndex(value: unknown, cardCount: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback
  return n >= 0 && n < cardCount ? n : fallback
}

/** Pads/truncates to exactly `n` items using `fallback` (by position) to fill any gap — used for Page 07's funnel banner, whose 3-item layout is fixed by the frozen template with no prop to add/remove steps. */
function coerceExactCount(items: string[], n: number, fallback: string[]): string[] {
  const result = items.slice(0, n)
  while (result.length < n) result.push(fallback[result.length] ?? '')
  return result
}

const FUNNEL_STEPS_FALLBACK = ['Increase visibility', 'Increase enquiries', 'Increase contracts.']

/** Coerces Claude's `enrichment` object for Page07's own 0-2 block slot — the shared enrichmentBlocks.ts module handles layout validation/coercion/dedup/cap; this just extracts the raw array and applies Page07's specific cap. */
function coerceEnrichment(page07: Record<string, unknown>): ProposalContentPages['page07']['enrichment'] {
  const raw = coerceNestedObject(page07.enrichment)
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : []
  return { blocks: coerceEnrichmentBlocks(rawBlocks, 2) }
}

/** Builds the full insightsBusiness content object (Business Intelligence: Where You Stand Today — a premium page inserted after Page 07) — shared by the single-shot and per-page generation paths. */
function buildInsightsBusinessContent(insightsBusiness: Record<string, unknown>): ProposalContentPages['insightsBusiness'] {
  const currentPosition = (Array.isArray(insightsBusiness.currentPosition) ? insightsBusiness.currentPosition : [])
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object')
    .map((d) => ({
      label: fitToConstraint('insightsBusiness.currentPositionLabel', coerceStringField(d, 'label')),
      currentScore: coerceScore0to10(d.currentScore),
      targetScore: coerceScore0to10(d.targetScore),
    }))
    .filter((d) => d.label.trim().length > 0)

  const swotRaw = coerceNestedObject(insightsBusiness.swot)

  return {
    businessOverview: coerceFittedStringField(insightsBusiness, 'businessOverview', 'insightsBusiness.businessOverview'),
    // >=3 not >=2 — the radar chart this feeds (ProposalPageInsightsBusiness.tsx)
    // needs at least 3 axes to read as a real shape, not a degenerate sliver.
    currentPosition: currentPosition.length >= 3 ? currentPosition : [],
    swot: {
      strengths: coerceFittedStringArrayField(swotRaw, 'strengths', 'insightsBusiness.swotItem'),
      weaknesses: coerceFittedStringArrayField(swotRaw, 'weaknesses', 'insightsBusiness.swotItem'),
      risks: coerceFittedStringArrayField(swotRaw, 'risks', 'insightsBusiness.swotItem'),
    },
  }
}

/** Builds the full insightsGrowth content object (Business Intelligence: The Opportunity Ahead — a premium page inserted after Page 07) — shared by the single-shot and per-page generation paths. */
function buildInsightsGrowthContent(insightsGrowth: Record<string, unknown>): ProposalContentPages['insightsGrowth'] {
  const growthOpportunities = (Array.isArray(insightsGrowth.growthOpportunities) ? insightsGrowth.growthOpportunities : [])
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({
      title: fitToConstraint('insightsGrowth.opportunityTitle', coerceStringField(c, 'title')),
      description: fitToConstraint('insightsGrowth.opportunityDescription', coerceStringField(c, 'description')),
    }))
    .filter((c) => c.title.trim().length > 0)

  return {
    growthOpportunities,
    marketIndustryPosition: coerceFittedStringField(insightsGrowth, 'marketIndustryPosition', 'insightsGrowth.marketIndustryPosition'),
    futureGrowthPotential: coerceFittedStringField(insightsGrowth, 'futureGrowthPotential', 'insightsGrowth.futureGrowthPotential'),
  }
}

/** Builds the full page07 content object (shared by the single-shot and per-page generation paths). */
function buildPage07Content(page07: Record<string, unknown>): ProposalContentPages['page07'] {
  return {
    heading: coerceFittedStringField(page07, 'heading', 'page07.heading'),
    kicker: coerceFittedStringField(page07, 'kicker', 'page07.kicker'),
    description: coerceFittedStringField(page07, 'description', 'page07.description'),
    situation: coerceFittedStringField(page07, 'situation', 'page07.situation'),
    opportunity: coerceFittedStringField(page07, 'opportunity', 'page07.opportunity'),
    demandIntro: coerceFittedStringField(page07, 'demandIntro', 'page07.demandIntro'),
    keywords: coerceFittedStringArrayField(page07, 'keywords', 'page07.keyword'),
    funnelSteps: coerceExactCount(coerceFittedStringArrayField(page07, 'funnelSteps', 'page07.funnelStep'), 3, FUNNEL_STEPS_FALLBACK),
    enrichment: coerceEnrichment(page07),
  }
}

/** Builds the full page08 content object (shared by the single-shot and per-page generation paths) — cards first, then resolves recommended/complementary indices against the FINAL card list (post-padding) so they're always valid. */
function buildPage08Content(page08: Record<string, unknown>): ProposalContentPages['page08'] {
  const cards = coerceCardsArray(page08)
  const recommendedIndex = coerceCardIndex(page08.recommendedCardIndex, cards.length, 0)
  let complementaryIndex = coerceCardIndex(page08.complementaryCardIndex, cards.length, 1)
  if (complementaryIndex === recommendedIndex) {
    complementaryIndex = recommendedIndex === 0 ? Math.min(1, cards.length - 1) : 0
  }

  return {
    investmentExplanation: coerceFittedStringField(page08, 'investmentExplanation', 'page08.investmentExplanation'),
    cards,
    recommendedCardId: cards[recommendedIndex]?.id ?? '',
    complementaryCardId: cards[complementaryIndex]?.id ?? '',
    outcomeLine: coerceFittedStringField(page08, 'outcomeLine', 'page08.comboOutcome'),
    resultsLine: coerceFittedStringField(page08, 'resultsLine', 'page08.comboResults'),
    packageDescriptions: [],
  }
}

/** Claude is instructed to return only JSON, but never trust that blindly —
 * strip any accidental code fences, then coerce every field to its expected
 * type so a malformed/partial model response can never reach the client as
 * anything other than a valid ProposalContent shape. */
function coerceContent(raw: unknown): ProposalContent {
  const result = emptyProposalContent()
  if (!raw || typeof raw !== 'object') return result
  const obj = raw as Record<string, unknown>
  const pages = coerceNestedObject(obj.pages)

  const page01 = coerceNestedObject(pages.page01)
  result.pages.page01 = {
    title: coerceFittedStringField(page01, 'title', 'cover.title'),
    tags: coerceFittedStringArrayField(page01, 'tags', 'cover.tag'),
    introduction: coerceFittedStringField(page01, 'introduction', 'cover.introduction'),
  }

  const page02 = coerceNestedObject(pages.page02)
  result.pages.page02 = {
    companyUnderstanding: coerceFittedStringField(page02, 'companyUnderstanding', 'page02.companyUnderstanding'),
    welcomeMessage: coerceFittedStringField(page02, 'welcomeMessage', 'page02.welcomeMessage'),
    introParagraph: coerceFittedStringField(page02, 'introParagraph', 'page02.introParagraph'),
  }

  result.pages.page05 = coerceFittedStringField(pages, 'page05', 'page05')
  result.pages.page06 = coerceStringField(pages, 'page06')
  result.pages.page07 = buildPage07Content(coerceNestedObject(pages.page07))
  result.pages.insightsBusiness = buildInsightsBusinessContent(coerceNestedObject(pages.insightsBusiness))
  result.pages.insightsGrowth = buildInsightsGrowthContent(coerceNestedObject(pages.insightsGrowth))

  result.pages.page08 = buildPage08Content(coerceNestedObject(pages.page08))

  const page09 = coerceNestedObject(pages.page09)
  result.pages.page09 = {
    timeline: coerceStringField(page09, 'timeline'),
    deliverables: coerceStringArrayField(page09, 'deliverables'),
  }

  const page11 = coerceNestedObject(pages.page11)
  result.pages.page11 = {
    closingMessage: coerceStringField(page11, 'closingMessage'),
    envelopeMessage: coerceFittedStringField(page11, 'envelopeMessage', 'page11.envelopeMessage'),
  }

  return result
}

/** Coerces one page's response into just the ProposalContentPages slice that page needs — everything else stays at its empty default so the caller can merge it into whatever's already been generated. `subHeading` (Blueprint-only, no ProposalContent equivalent) is returned separately, only for `cover`. */
function coercePageContent(pageId: AutoGeneratePageId, raw: unknown): { content: Partial<ProposalContentPages>; subHeading?: string } {
  const obj = coerceNestedObject(raw)
  const pages = coerceNestedObject(obj.pages)

  if (pageId === 'cover') {
    const page01 = coerceNestedObject(pages.page01)
    return {
      content: {
        page01: {
          title: coerceFittedStringField(page01, 'title', 'cover.title'),
          tags: coerceFittedStringArrayField(page01, 'tags', 'cover.tag'),
          introduction: coerceFittedStringField(page01, 'introduction', 'cover.introduction'),
        },
      },
      subHeading: coerceFittedStringField(page01, 'subHeading', 'cover.subHeading'),
    }
  }
  if (pageId === 'page02') {
    const page02 = coerceNestedObject(pages.page02)
    return {
      content: {
        page02: {
          companyUnderstanding: coerceFittedStringField(page02, 'companyUnderstanding', 'page02.companyUnderstanding'),
          welcomeMessage: coerceFittedStringField(page02, 'welcomeMessage', 'page02.welcomeMessage'),
          introParagraph: coerceFittedStringField(page02, 'introParagraph', 'page02.introParagraph'),
        },
      },
    }
  }
  if (pageId === 'page07') {
    return { content: { page07: buildPage07Content(coerceNestedObject(pages.page07)) } }
  }
  if (pageId === 'insightsBusiness') {
    return { content: { insightsBusiness: buildInsightsBusinessContent(coerceNestedObject(pages.insightsBusiness)) } }
  }
  if (pageId === 'insightsGrowth') {
    return { content: { insightsGrowth: buildInsightsGrowthContent(coerceNestedObject(pages.insightsGrowth)) } }
  }
  if (pageId === 'page08') {
    return { content: { page08: buildPage08Content(coerceNestedObject(pages.page08)) } }
  }
  if (pageId === 'page11') {
    const page11 = coerceNestedObject(pages.page11)
    return { content: { page11: { closingMessage: '', envelopeMessage: coerceFittedStringField(page11, 'envelopeMessage', 'page11.envelopeMessage') } } }
  }
  // page05 only remaining case — a single plain string field, constraint key === pageId
  return { content: { [pageId]: coerceFittedStringField(pages, pageId, pageId) } }
}

/** Builds one dynamicInsight0N page's content — `title` is passed through verbatim from the already-decided DynamicPagePlanEntry (see blueprint/types.ts), never regenerated here; only `kicker` and the one visual block (pre-told its layout) are actually generated. */
function coerceDynamicInsightPageContent(title: string, raw: unknown): ProposalContentDynamicInsightPage {
  const obj = coerceNestedObject(raw)
  const kicker = coerceFittedStringField(obj, 'kicker', 'page07.kicker')
  const blocks = coerceEnrichmentBlocks([coerceNestedObject(obj.block)], 1)
  return { title, kicker, blocks }
}

/** The Meeting-Transcript auto-flow's per-page call for one dynamicInsight0N slot — `layout`/`title` come from the Content Architect's already-decided, already-saved DynamicPagePlanEntry (see autoGenerate.ts), never re-decided here. */
async function handleGenerateDynamicInsightPage(
  apiKey: string,
  pageId: DynamicInsightPageId,
  body: Record<string, unknown>,
  intelligence: ProposalIntelligence,
  proposal: BlueprintProposalContext,
  res: VercelResponse
) {
  const layout = typeof body.layout === 'string' ? body.layout : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!BLOCK_LAYOUTS.includes(layout as (typeof BLOCK_LAYOUTS)[number])) {
    return res.status(400).json({ error: 'Missing or invalid required field: layout' })
  }
  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' })
  }
  const validLayout = layout as Page07BlockLayout

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 1536,
      system: buildContentSystemPromptForDynamicPage(validLayout, title, proposal.providerIdentity ?? 'novara'),
      userPrompt: buildContentUserPromptForPage(intelligence, proposal),
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error(`generate-content.ts (generatePage/${pageId}): failed to parse model response as JSON:`, e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    return res.status(200).json({ content: { [pageId]: coerceDynamicInsightPageContent(title, parsed) } } as { content: Partial<ProposalContentPages> })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error(`generate-content.ts (generatePage/${pageId}) fetch error:`, e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}

/**
 * Content Architect for the Meeting-Transcript auto-flow — the same
 * decision blueprint/prompts.ts's buildDynamicPagePlanSystemPrompt makes
 * for the manual Blueprint flow (see api/ai/generate-blueprint.ts's 4th
 * parallel call), reachable here because the auto-flow never calls that
 * route at all (it talks only to this one, per-page). Optional value-add,
 * not core generation — always resolves 200 with a plan (possibly empty)
 * on any failure, so a stuck/failed decision degrades to "no extra pages"
 * rather than blocking the rest of the auto-flow.
 */
async function handlePlanDynamicPages(apiKey: string, body: Record<string, unknown>, res: VercelResponse) {
  if (!body.intelligence) {
    return res.status(400).json({ error: 'Missing required field: intelligence' })
  }
  const intelligence = sanitizeIntelligenceInput(body.intelligence)
  const proposal = sanitizeProposalContext(body.proposal)

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 768,
      system: buildDynamicPagePlanSystemPrompt(proposal.providerIdentity ?? 'novara'),
      userPrompt: buildDynamicPagePlanUserPrompt(intelligence, proposal),
    })
    let parsed: unknown = null
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error('generate-content.ts (planDynamicPages): failed to parse model response as JSON, defaulting to no extra pages:', e instanceof Error ? e.message : e)
    }
    return res.status(200).json({ dynamicPagePlan: coerceDynamicPagePlan(parsed) })
  } catch (e) {
    console.error('generate-content.ts (planDynamicPages) fetch error, defaulting to no extra pages:', e instanceof Error ? e.message : e)
    return res.status(200).json({ dynamicPagePlan: { pages: [] } })
  }
}

async function handleGeneratePage(apiKey: string, body: Record<string, unknown>, res: VercelResponse) {
  const pageId = body.pageId
  const isDynamic = typeof pageId === 'string' && (DYNAMIC_INSIGHT_PAGE_IDS as readonly string[]).includes(pageId)
  const isBase = typeof pageId === 'string' && (AUTO_GENERATE_PAGE_ORDER as readonly string[]).includes(pageId)
  if (typeof pageId !== 'string' || !(isDynamic || isBase)) {
    return res.status(400).json({ error: 'Missing or invalid required field: pageId' })
  }
  if (!body.intelligence) {
    return res.status(400).json({ error: 'Missing required field: intelligence' })
  }
  const intelligence = sanitizeIntelligenceInput(body.intelligence)
  const proposal = sanitizeProposalContext(body.proposal)
  const validPageId = pageId as AutoGeneratePageId

  if (isDynamic) {
    return await handleGenerateDynamicInsightPage(apiKey, validPageId as DynamicInsightPageId, body, intelligence, proposal, res)
  }

  // page07 only — layouts the Content Architect already committed to other
  // pages in this same proposal (decided before page07 is ever generated;
  // see autoGenerate.ts), so page07's own independent layout pick can't
  // collide with one of them. Malformed/unknown entries are dropped rather
  // than trusted, same defensive posture as every other AI-adjacent input.
  const rawExcludeLayouts = Array.isArray(body.excludeLayouts) ? body.excludeLayouts : []
  const excludeLayouts = rawExcludeLayouts.filter((l): l is Page07BlockLayout => BLOCK_LAYOUTS.includes(l as (typeof BLOCK_LAYOUTS)[number]))

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      // page07/page08/insightsBusiness/insightsGrowth return many more fields than every other page's small flat field group (page07: heading/kicker/description/situation/opportunity/demandIntro/keywords[]/funnelSteps[]/enrichment blocks; page08: an array of pricing cards; insightsBusiness: currentPosition[]/swot; insightsGrowth: growthOpportunities[]). page07 and insightsGrowth's budgets are higher still when web search is enabled — search-query/result blocks and citations consume output tokens too, on top of the JSON payload itself.
      maxTokens: validPageId === 'page08' ? 2048 : validPageId === 'page07' || validPageId === 'insightsGrowth' ? 3072 : validPageId === 'insightsBusiness' ? 1536 : 768,
      system: buildContentSystemPromptForPage(validPageId, excludeLayouts, proposal.providerIdentity ?? 'novara'),
      userPrompt: buildContentUserPromptForPage(intelligence, proposal),
      ...(validPageId === 'page07' || validPageId === 'insightsGrowth' ? { tools: [WEB_SEARCH_TOOL], timeoutMs: 90_000 } : {}),
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error(`generate-content.ts (generatePage/${validPageId}): failed to parse model response as JSON:`, e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    return res.status(200).json(coercePageContent(validPageId, parsed))
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error(`generate-content.ts (generatePage/${validPageId}) fetch error:`, e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = (req.body as { action?: string; blueprint?: unknown } & Record<string, unknown>) || {}

  if (body.action === 'generatePage') return await handleGeneratePage(apiKey, body, res)
  if (body.action === 'planDynamicPages') return await handlePlanDynamicPages(apiKey, body, res)

  if (!body.blueprint) {
    return res.status(400).json({ error: 'Missing required field: blueprint' })
  }
  const blueprint = sanitizeBlueprintInput(body.blueprint)
  const userPrompt = buildContentUserPrompt(blueprint)
  const identity: ProviderIdentity = blueprint.variables.providerIdentity ?? 'novara'

  // Three parallel calls, not one — a single request asking for every
  // page's fields at once is the exact shape that has repeatedly timed out
  // in production (see generate-blueprint.ts's own narrative/page-content-A/
  // page-content-B split, and the auto-flow's per-page calls). Pages 07/08
  // got materially bigger once brought to parity with the auto-flow, so
  // they're split into their own call with a larger token budget; the
  // Business Intelligence pages (insightsBusiness/insightsGrowth, inserted
  // after Page 07 — never the frozen Page 03/04) get the same treatment for
  // the same reason, plus a real web_search round trip for insightsGrowth's
  // market/industry/competitor research. All three responses are merged
  // into one `{ pages: {...} }` object before the existing, unchanged
  // coerceContent() runs over it.
  try {
    const [compactText, pages0708Text, pagesInsightsText] = await Promise.all([
      callClaude({
        apiKey,
        model: 'claude-sonnet-4-6',
        maxTokens: 3072,
        system: buildContentSystemPromptCompact(identity),
        userPrompt,
      }),
      callClaude({
        apiKey,
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        system: buildContentSystemPromptPages0708(identity),
        userPrompt,
      }),
      callClaude({
        apiKey,
        model: 'claude-sonnet-4-6',
        maxTokens: 3072,
        system: buildContentSystemPromptPagesInsights(identity),
        userPrompt,
        tools: [WEB_SEARCH_TOOL],
        timeoutMs: 90_000,
      }),
    ])

    let compactParsed: unknown
    let pages0708Parsed: unknown
    let pagesInsightsParsed: unknown
    try {
      compactParsed = extractJson(compactText)
      pages0708Parsed = extractJson(pages0708Text)
      pagesInsightsParsed = extractJson(pagesInsightsText)
    } catch (e) {
      console.error('generate-content.ts: failed to parse model response as JSON:', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    const compactPages = coerceNestedObject((coerceNestedObject(compactParsed)).pages)
    const pages0708 = coerceNestedObject((coerceNestedObject(pages0708Parsed)).pages)
    const pagesInsights = coerceNestedObject((coerceNestedObject(pagesInsightsParsed)).pages)
    const merged = { pages: { ...compactPages, ...pages0708, ...pagesInsights } }

    return res.status(200).json({ content: coerceContent(merged) })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('generate-content.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
