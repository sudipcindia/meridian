import type { ProposalBlueprint } from '../blueprint/index.js'
import type { ProposalIntelligence } from '../intelligence/index.js'
import type { BlueprintProposalContext } from '../blueprint/types.js'
import { JSON_OBJECT_RESPONSE_ONLY } from '../ai/promptFragments.js'
import { FIELD_CONSTRAINTS, constraintInstruction } from './templateConstraints.js'
import type { Page07BlockLayout } from './types.js'
import { getProviderName, getVoiceGuidance, type ProviderIdentity } from '../branding/identity.js'

/** Applied to the handful of hardcoded field-description strings below that name "Novara" directly (e.g. "why Novara specifically is the right partner") — a no-op for the default identity. This is substitution over our own prompt copy, never over client/user data. */
function withProviderName(text: string, identity: ProviderIdentity): string {
  if (identity === 'novara') return text
  return text.replace(/\bNovara\b/g, getProviderName(identity))
}

/**
 * Prompt-building for Phase 05 — Sales Content Engine. Input is the
 * already-generated Proposal Blueprint (Phase 03) — every fact (client
 * info, pain points, goals, challenges, competitors, recommended
 * services, strategy, deliverables, timeline, KPIs, pricing, ROI) is
 * already verified and structured; this phase's only job is turning those
 * facts into persuasive, page-mapped proposal COPY. api/ai/generate-content.ts
 * still defensively re-validates and coerces the parsed result server-side
 * — this prompt reduces how often that fallback is needed, it isn't the
 * only safeguard.
 *
 * Every field description below embeds a character/word/line guide from
 * templateConstraints.ts — measured off the frozen master template's actual
 * CSS. Pages 07/08 now grow to fit their content rather than clipping it, so
 * most of these are soft guidance, not hard ceilings — see
 * templateConstraints.ts for exactly which fields remain genuinely fixed
 * (nowrap card titles/prices, single-line headings) versus which are free
 * to run long.
 */

/**
 * Referenced from insightsGrowth's marketIndustryPosition field description
 * below. Both insightsGrowth and page07 get the same web_search tool
 * attached (see generate-content.ts's WEB_SEARCH_TOOL/handleGeneratePage) —
 * this fragment tells Claude specifically what to do with it for THIS
 * field, distinct from page07's own WEB_RESEARCH_RULE (which grounds
 * situation/keywords).
 */
const MARKET_RESEARCH_FIELD_RULE =
  'You have a web_search tool available for this field specifically. Use it to research: (a) the client\'s own website if intelligence.client.website is non-empty, (b) the named competitors in intelligence.competitors (or, if none are named, likely competitors by intelligence.client.industry + intelligence.client.location), and (c) current trends in intelligence.client.industry. Write this paragraph grounded in what you actually find — cite real, specific things (a named competitor, a real trend, a real market signal) rather than vague generalities. If search returns nothing useful, fall back to a shorter, more general statement reasoned from the confirmed Proposal Intelligence alone — never invent a specific competitor name, statistic, or trend that search didn\'t actually surface.'

/**
 * One grounding paragraph per visual block layout — each defines exactly
 * what real client fact would justify choosing it, and disambiguates it
 * from its closest sibling (e.g. comparisonBars vs beforeAfter). Extracted
 * to its own map (rather than inlined once into page07's field description)
 * so the same 11 paragraphs can be reused unchanged by a future page that
 * offers only one pre-assigned layout instead of Page07's own "pick up to
 * two" menu (see masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS) —
 * never re-typed, never allowed to drift between the two call sites.
 */
export const ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS: Record<string, string> = {
  stats: `"stats": 3-4 real, defensible figures drawn from THIS client's own stated situation (years trading, number of locations, stated budget, number of missed enquiries, etc.) — never a fabricated percentage or invented industry-average statistic. Each item: { value (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.statValue'])}, a short punchy figure e.g. "15 yrs", "3 sites"), label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.statLabel'])}) }.`,
  beforeAfter: `"beforeAfter": only when there's a genuine, nameable current-state vs future-state contrast (e.g. manual spreadsheet tracking vs an automated CRM). { beforeLabel (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.beforeAfterLabel'])}, e.g. "Right Now"), beforeText (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.beforeAfterText'])}), afterLabel (string, same limit, e.g. "With Novara"), afterText (string, same limit as beforeText) }.`,
  roadmap: `"roadmap": only when intelligence.timeline genuinely describes distinct phases. roadmapSteps (array, 3-4 items): { title (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.roadmapTitle'])}), description (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.roadmapDescription'])}) }.`,
  opportunityCards: `"opportunityCards": only when intelligence.opportunities names several distinct, real opportunities worth presenting as separate cards. opportunityCards (array, 3-4 items): { title (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.opportunityCardTitle'])}), description (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.opportunityCardDescription'])}) }.`,
  comparisonBars: `"comparisonBars": a "current position vs with Novara" bar-chart comparison across 3-4 named dimensions genuinely relevant to this client's actual pain points/challenges (e.g. "Website & Digital Presence", "Lead Capture & CRM", "Search Visibility", "Investor-Ready Positioning" — pick dimensions that map to THIS client's real situation, never a generic fixed list). This is explicitly Novara's own expert assessment, not measured analytics — score honestly: currentScore should be genuinely low only when the client's stated situation supports it, and targetScore should be a credible, not maximal, outcome (rarely 10/10). comparisonBars (array, 3-4 items): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.comparisonBarLabel'])}), currentScore (integer 0-10), targetScore (integer 0-10, greater than currentScore) }. Use this layout when the client's situation is genuinely multi-dimensional (several distinct weak areas) rather than one single contrast (which "beforeAfter" already covers).`,
  funnel: `"funnel": a descending conversion/pipeline funnel — only when this client's actual growth path genuinely has distinct sequential stages (e.g. "Website Visitors" → "Qualified Enquiries" → "Booked Calls" → "Signed Contracts", grounded in intelligence.painPoints/goals, not a generic template funnel). funnelStages (array, 3-4 items, in descending order): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.funnelStageLabel'])}), value (integer 100 down to a smaller number reflecting realistic relative drop-off — a RELATIVE weight for the shape's width, never a claimed literal measured figure unless the client's own stated numbers genuinely support one) }. Do not use this same funnel narrative as the page's existing separate 3-step funnel banner — pick a different, complementary angle if you use this layout.`,
  stackedBar: `"stackedBar": one single bar showing a real proportional split — e.g. how the recommended investment/effort divides across intelligence.recommendedServices, or how a project timeline's phases divide by relative duration. Frame stackedBarTitle honestly (e.g. "Approximate focus across the first quarter", never implying audited/measured data). { stackedBarTitle (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.stackedBarTitle'])}), stackedBarSegments (array, 2-4 items, percentages summing to ~100): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.stackedBarSegmentLabel'])}), percent (integer) } }.`,
  treemap: `"treemap": 3-6 named items sized by genuine relative priority/emphasis — e.g. which of intelligence.challenges/opportunities/recommendedServices matter most for this client, weighted by how much real emphasis the client's own words gave them (never a fabricated statistic). treemapItems (array, 3-6 items): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.treemapItemLabel'])}), weight (integer, relative sizing only) }.`,
  projection: `"projection": a time-series forecast — the ONLY layout with a genuine time dimension; every other layout above is a single-snapshot comparison. Use only when a credible trajectory over time is genuinely supportable (e.g. revenue/lead-volume/ROI growth across the engagement's phases or months), grounded in intelligence.commercial/goals/timeline — never invent specific projected figures unless the client's own numbers or a clearly-labelled realistic estimate supports them. { projectionTitle (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.projectionTitle'])}), projectionUnit (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.projectionUnit'])}, e.g. "%", "k", "£" — appended directly after each value, no space), projectionPoints (array, 3-5 items, in chronological order): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.projectionPointLabel'])}, a short time label e.g. "Month 3"), value (number) } }.`,
  priorityMatrix: `"priorityMatrix": a 2x2 grid plotting several real initiatives/opportunities against two axes — only when at least 3 genuinely distinct items exist to compare (e.g. recommended services or opportunities plotted by Effort vs Impact, or Cost vs Urgency) — never invent items just to fill the grid. { priorityMatrixXLabel (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.priorityMatrixAxisLabel'])}, e.g. "Effort"), priorityMatrixYLabel (string, same limit, e.g. "Impact"), priorityMatrixItems (array, 3-5 items): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.priorityMatrixItemLabel'])}), x (integer 0-10), y (integer 0-10) }. Score honestly and relative to this client's own priorities, never a generic textbook placement.`,
  comparisonTable: `"comparisonTable": a feature/commercial comparison table — only when there are genuinely 2+ things worth comparing side by side (e.g. current state vs with Novara across several concrete capabilities, or two service tiers) across 2-4 columns. { comparisonTableTitle (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.comparisonTableTitle'])}), comparisonTableColumns (string[], 2-4 items, first column is implicitly the row-label column and should NOT be included here — only the value column headers, e.g. ["Today", "With Novara"]), comparisonTableRows (array, 3-6 items): { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.comparisonTableRowLabel'])}, the feature/item being compared), values (string[], one short value per column in comparisonTableColumns, each ${constraintInstruction(FIELD_CONSTRAINTS['page07.enrichment.comparisonTableCell'])}) } }.`,
}

/**
 * Per-page field groups — the single source of truth for both the
 * per-page auto-flow prompt (buildContentSystemPromptForPage, used by the
 * Meeting-Transcript flow) and the manual Blueprint-flow prompt
 * (buildContentSystemPrompt, below) via PAGE_SCHEMA_FIELDS. Previously the
 * manual flow had its own, much thinner field list for page07/page08 (3
 * fields total) while this richer list (17 combined) was only ever asked
 * for by the auto-flow — meaning a proposal built via the manual Blueprint
 * page always fell back to empty strings / the hardcoded default pricing
 * cards for page07/page08, regardless of how detailed the underlying
 * Proposal Intelligence was. Both flows now ask for the same fields.
 */
const PAGE_FIELD_GROUPS: Record<string, string[]> = {
  cover: [
    `pages.page01.title (string) — a short, punchy 1-3 word Cover title (${constraintInstruction(FIELD_CONSTRAINTS['cover.title'])}) — a bold poster-style word or phrase, not a sentence`,
    `pages.page01.subHeading (string) — a short second line completing the Cover title (${constraintInstruction(FIELD_CONSTRAINTS['cover.subHeading'])}) — reads together with the title as one short two-line statement, not a separate sentence`,
    `pages.page01.tags (string[]) — 3-5 capability tags for the Cover page, each ${constraintInstruction(FIELD_CONSTRAINTS['cover.tag'])}`,
    `pages.page01.introduction (string) — a Cover page introduction naming the client's core problem (${constraintInstruction(FIELD_CONSTRAINTS['cover.introduction'])})`,
  ],
  page02: [
    `pages.page02.companyUnderstanding (string) — demonstrates a specific understanding of this client's company and situation (${constraintInstruction(FIELD_CONSTRAINTS['page02.companyUnderstanding'])}; may use one blank line to start a second short paragraph)`,
    `pages.page02.welcomeMessage (string) — a short, warm, personal welcome message for this specific client (${constraintInstruction(FIELD_CONSTRAINTS['page02.welcomeMessage'])})`,
    `pages.page02.introParagraph (string) — an introductory paragraph bridging into the rest of the proposal (${constraintInstruction(FIELD_CONSTRAINTS['page02.introParagraph'])})`,
  ],
  // Business Intelligence sections — premium pages inserted after Page 07
  // (insightsBusiness/insightsGrowth — see masterTemplate/index.ts; NOT the
  // frozen Page03/04, which stay static core template content). The client
  // should immediately think "they've really understood my business." Every
  // field here is grounded ONLY in real ProposalBlueprint facts (transcript
  // + questionnaire answers); never fabricate specifics to sound thorough.
  // An empty/short array or string simply hides that section on the page
  // rather than being padded with filler — see buildInsightsBusinessContent/
  // buildInsightsGrowthContent's coercion for the exact drop rules.
  insightsBusiness: [
    `pages.insightsBusiness.businessOverview (string) — 2-4 sentences describing who this business actually is, what it does, and its scale — grounded in intelligence.client.company/industry/businessType/companySize and intelligence.business.currentSituation (${constraintInstruction(FIELD_CONSTRAINTS['insightsBusiness.businessOverview'])}). Must read as proof Novara actually understood this specific business, never a generic industry description that could apply to any competitor.`,
    `pages.insightsBusiness.currentPosition (array, 3-5 items) — "Current Position & Digital Maturity Assessment": score this client's real current state across dimensions genuinely relevant to THEIR situation (e.g. "Website & Digital Presence", "Marketing & Visibility", "Systems & CRM", "Lead Capture & Follow-up" — pick dimensions that map to what was actually discussed, never a fixed generic list), grounded in intelligence.business.currentWebsite/currentMarketing/existingCRM/existingAds/existingSEO and intelligence.painPoints. This is explicitly Novara's own expert assessment, not measured analytics — score honestly: currentScore should be genuinely low only when the client's stated situation supports it, and targetScore should be a credible, not maximal, outcome (rarely 10/10). Each item: { label (string, ${constraintInstruction(FIELD_CONSTRAINTS['insightsBusiness.currentPositionLabel'])}), currentScore (integer 0-10), targetScore (integer 0-10, greater than currentScore) }.`,
    `pages.insightsBusiness.swot (object) — { strengths: string[], weaknesses: string[], risks: string[] }, each item ${constraintInstruction(FIELD_CONSTRAINTS['insightsBusiness.swotItem'])}, grounded in intelligence.painPoints/challenges/goals/competitors/opportunities/objections. Populate each array with 2-4 items ONLY when real, defensible ones exist for that category — if fewer than 2 genuine items exist for strengths, weaknesses, or risks specifically, return an empty array for that one rather than padding with generic filler. It is fine for one or two of the three arrays to be empty if the Blueprint genuinely doesn't support them.`,
  ],
  insightsGrowth: [
    `pages.insightsGrowth.growthOpportunities (array, 3-4 items) — "Growth Opportunities & Missed Opportunities" combined into one set of cards, grounded in intelligence.opportunities/goals/recommendedServices — real, specific opportunities this client is leaving on the table today, never a generic "grow your business" card. Each item: { title (string, ${constraintInstruction(FIELD_CONSTRAINTS['insightsGrowth.opportunityTitle'])}), description (string, ${constraintInstruction(FIELD_CONSTRAINTS['insightsGrowth.opportunityDescription'])}) }.`,
    `pages.insightsGrowth.marketIndustryPosition (string) — "Market Potential, Industry Trends & Competitive Position" combined into one paragraph (${constraintInstruction(FIELD_CONSTRAINTS['insightsGrowth.marketIndustryPosition'])}). ${MARKET_RESEARCH_FIELD_RULE}`,
    `pages.insightsGrowth.futureGrowthPotential (string) — where this business could realistically be in 12-24 months if it acts on this proposal, grounded in intelligence.goals/timeline/recommendedServices (${constraintInstruction(FIELD_CONSTRAINTS['insightsGrowth.futureGrowthPotential'])}) — a credible, specific projection tied to this client's own stated goals, never a vague growth platitude.`,
  ],
  page05: [
    `pages.page05 (string) — a short, punchy 1-3 word phrase completing the heading "Experience Across ___." (${constraintInstruction(FIELD_CONSTRAINTS.page05)}), reflecting the recommended strategy focus in one word or phrase (e.g. "Sectors.", "Industries."). This is a heading accent, NOT a sentence or paragraph.`,
  ],
  page07: [
    `pages.page07.heading (string) — a short phrase completing "___, [Client First Name]" as a two-part heading (${constraintInstruction(FIELD_CONSTRAINTS['page07.heading'])}) — reads together with the client's first name, not a full sentence on its own (e.g. "Your Custom Proposal,", "A Plan Built for,")`,
    `pages.page07.kicker (string) — a short label naming what kind of proposal this actually is (${constraintInstruction(FIELD_CONSTRAINTS['page07.kicker'])}) — MUST match the actual recommended strategy (e.g. "Brand & Growth Proposal" if positioning-led, "Paid Social & SEO Proposal" if channel-led). Never default to "SEO" framing unless SEO is genuinely part of the recommended services.`,
    `pages.page07.description (string) — why Novara specifically is the right partner for this client, confident but not boastful (${constraintInstruction(FIELD_CONSTRAINTS['page07.description'])})`,
    `pages.page07.situation (string) — this client's specific business situation: the demand or opportunity that exists but isn't being captured, grounded in their pain points and current situation (${constraintInstruction(FIELD_CONSTRAINTS['page07.situation'])})`,
    `pages.page07.opportunity (string) — the market opportunity this client is missing out on and why it matters now, grounded in their competitors and stated opportunities (${constraintInstruction(FIELD_CONSTRAINTS['page07.opportunity'])})`,
    `pages.page07.demandIntro (string) — a short label introducing the keyword/positioning tags below it (${constraintInstruction(FIELD_CONSTRAINTS['page07.demandIntro'])}) — phrase it to match what the tags actually represent (search-behaviour language only if the tags genuinely are search keywords; otherwise a neutral audience/positioning framing). Do not assume "searching" language by default.`,
    `pages.page07.keywords (string[], 5-7 items) — real, specific terms relevant to this client: search keywords and locations if SEO is genuinely part of the recommended strategy, otherwise short audience/positioning/channel tags — each ${constraintInstruction(FIELD_CONSTRAINTS['page07.keyword'])}. Never generic, and never copy-pasteable to another client in a different industry or location.`,
    `pages.page07.funnelSteps (string[], EXACTLY 3 items) — a 3-step process naming this client's actual growth funnel, in order (e.g. "Increase visibility" → "Increase enquiries" → "Increase contracts."), each ${constraintInstruction(FIELD_CONSTRAINTS['page07.funnelStep'])}`,
    `pages.page07.enrichment (object) — 1-2 visual "blocks" shown stacked between the "Where You Stand" paragraphs and the demand keywords: { blocks: [...] }. This page is the client's main event — make it feel graphically rich and genuinely personalised, not a wall of paragraphs. Pick up to TWO complementary blocks (e.g. one narrative block like "beforeAfter" or "roadmap" PLUS one data/chart block like "comparisonBars", "funnel", "stackedBar", "treemap", "projection", "priorityMatrix", or "comparisonTable") from the 11 layouts below, choosing only what the ACTUAL data genuinely supports — never invent numbers, phases, or comparison points just to fill one, and never pick two blocks of the same layout. If nothing below genuinely fits, return { blocks: [] } (the situation/opportunity paragraphs above already carry the narrative). Each block in the array must include every key in this shape, populating only the ones matching its own layout and leaving the rest as empty arrays/strings: { layout: "stats" | "beforeAfter" | "roadmap" | "opportunityCards" | "comparisonBars" | "funnel" | "stackedBar" | "treemap" | "projection" | "priorityMatrix" | "comparisonTable", stats: [], beforeLabel: "", beforeText: "", afterLabel: "", afterText: "", roadmapSteps: [], opportunityCards: [], comparisonBars: [], funnelStages: [], stackedBarTitle: "", stackedBarSegments: [], treemapItems: [], projectionTitle: "", projectionUnit: "", projectionPoints: [], priorityMatrixXLabel: "", priorityMatrixYLabel: "", priorityMatrixItems: [], comparisonTableTitle: "", comparisonTableColumns: [], comparisonTableRows: [] }.
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.stats}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.beforeAfter}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.roadmap}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.opportunityCards}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.comparisonBars}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.funnel}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.stackedBar}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.treemap}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.projection}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.priorityMatrix}
      - ${ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS.comparisonTable}`,
  ],
  page08: [
    `pages.page08.investmentExplanation (string) — this is the "Recommended Approach" paragraph shown directly beneath the pricing cards, right above a box combining the recommended + complementary packages — it MUST explain, by their actual generated titles (never a hardcoded example pairing), why combining those two specific packages is the right move for this client, not a generic "value framing" statement that could apply to any proposal (${constraintInstruction(FIELD_CONSTRAINTS['page08.investmentExplanation'])})`,
    `pages.page08.cards (array, MINIMUM 2 items, based on intelligence.commercial.packageDetails/optionalServices) — one object per package actually discussed with this client. Never reduce a package to just a name and a price — every card must explain why it's right, what it includes, and what it changes for this client: { title (${constraintInstruction(FIELD_CONSTRAINTS['page08.card.title'])}), price (${constraintInstruction(FIELD_CONSTRAINTS['page08.card.price'])}, e.g. "£999"), priceSuffix (${constraintInstruction(FIELD_CONSTRAINTS['page08.card.priceSuffix'])}, e.g. "one-time payment" or "per month · 30 days notice" — reflect intelligence.commercial.paymentTerms/contractDuration if given), whyRecommended (string, ${constraintInstruction(FIELD_CONSTRAINTS['page08.card.whyRecommended'])} — why THIS package specifically fits this client, grounded in their actual pain points; never a generic "this package delivers value" line), features (string[], 4-6 items, each ${constraintInstruction(FIELD_CONSTRAINTS['page08.card.feature'])} — what work is actually included, specific enough that it couldn't be copy-pasted into an unrelated client's proposal), expectedOutcome (string, ${constraintInstruction(FIELD_CONSTRAINTS['page08.card.expectedOutcome'])} — what concretely changes for this client once delivered, tied to their stated goals in intelligence.goals), roiNote (string, ${constraintInstruction(FIELD_CONSTRAINTS['page08.card.roiNote'])} — ONLY write this if intelligence.commercial or intelligence.budget genuinely gives you real numbers to reason from, e.g. an average order value or a stated budget range; if so, compute a real, honestly-framed estimate from THOSE numbers, never an invented industry statistic; if no real figures exist, this MUST be an empty string "" — never fabricate one), footerNote (string, ${constraintInstruction(FIELD_CONSTRAINTS['page08.card.footerNote'])}, use intelligence.commercial.deposit/guarantees if relevant, otherwise "") }. Do NOT include an "id" field — omit it entirely. If intelligence.commercial.packageDetails only describes one package, still produce at least 2 distinct cards (e.g. split a natural core/add-on boundary, or use intelligence.commercial.optionalServices as a second tier) — never return fewer than 2.`,
    'pages.page08.recommendedCardIndex (number) — the 0-based index into pages.page08.cards of whichever card best matches intelligence.commercial.recommendedPackage (use 0 if none is clearly recommended)',
    'pages.page08.complementaryCardIndex (number) — the 0-based index of a second, different card in pages.page08.cards that pairs naturally with the recommended one (use 1 if unclear)',
    `pages.page08.outcomeLine (string) — a short, confident statement of the combined outcome of the recommended + complementary packages together, specific to this client (${constraintInstruction(FIELD_CONSTRAINTS['page08.comboOutcome'])})`,
    `pages.page08.resultsLine (string) — what results to expect and roughly when, grounded in intelligence.timeline/goals (${constraintInstruction(FIELD_CONSTRAINTS['page08.comboResults'])})`,
  ],
  page11: [
    `pages.page11.envelopeMessage (string) — a short, personal message accompanying the sent proposal, inviting this specific client to move forward (${constraintInstruction(FIELD_CONSTRAINTS['page11.envelopeMessage'])})`,
  ],
}

export function getPageFieldGroup(pageId: string): string[] {
  return PAGE_FIELD_GROUPS[pageId] ?? []
}

// Manual (Blueprint) flow only — split into three calls, exactly the same
// reasoning already applied to generate-blueprint.ts's own narrative/
// page-content-A/page-content-B split and to the auto-flow's per-page
// calls: one big single-shot request asking for every page's fields at
// once is the shape that has repeatedly timed out in production (see
// git history). "Compact" is every page except insightsBusiness/
// insightsGrowth/07/08 — small, always was fine at 4096 tokens. Page 07/08
// got materially bigger once their field list was brought to parity with
// the auto-flow (Phase 1c); the Business Intelligence pages became their
// own call for the same reason (real depth + a real web_search round trip
// for insightsGrowth), so each of these heavier pairs gets its own call
// with a larger budget.
const PAGE_SCHEMA_FIELDS_COMPACT: string[] = [
  ...PAGE_FIELD_GROUPS.cover,
  ...PAGE_FIELD_GROUPS.page02,
  ...PAGE_FIELD_GROUPS.page05,
  'pages.page06 (string) — Delivery Roadmap: how the recommended strategy will actually be delivered, phase by phase',
  'pages.page09.timeline (string) — a client-specific delivery timeline narrative',
  'pages.page09.deliverables (string[]) — concrete deliverables this client will receive',
  'pages.page11.closingMessage (string) — a confident, warm closing message specific to this client',
  ...PAGE_FIELD_GROUPS.page11,
]

const PAGE_SCHEMA_FIELDS_0708: string[] = [...PAGE_FIELD_GROUPS.page07, ...PAGE_FIELD_GROUPS.page08]
const PAGE_SCHEMA_FIELDS_INSIGHTS: string[] = [...PAGE_FIELD_GROUPS.insightsBusiness, ...PAGE_FIELD_GROUPS.insightsGrowth]

const LENGTH_DISCIPLINE_RULE =
  'Each field above carries a character/word/line guide in parentheses, measured off the real template design. A handful (marked in the field description itself, e.g. single-line headings or nowrap card prices) are genuine hard ceilings — never exceed those. Everything else is soft guidance for a well-proportioned page, not a clipping boundary: pages 07 and 08 grow to fit their content, so write as much as the client\'s situation genuinely warrants rather than padding or artificially cutting a passage short. If a field has a range and your first draft undershoots the low end, expand it naturally with one more concrete, client-specific detail rather than padding with filler.'

function consultantPersona(identity: ProviderIdentity): string {
  const providerName = getProviderName(identity)
  return `You are writing as a senior sales consultant at ${providerName}${identity === 'novara' ? ', a UK growth consultancy' : ''} — thinking simultaneously like a RevOps consultant, a growth strategist, a digital marketing consultant, and a business consultant.`
}

function blueprintIntake(identity: ProviderIdentity): string {
  const providerName = getProviderName(identity)
  return `You will be given a Proposal Blueprint: verified facts about a prospective client (industry, business size, current situation, pain points, goals, timeline, budget, competitors, recommended services, strategy, opportunities, and more), already confirmed by a ${providerName} team member. Treat every fact as ground truth.`
}

const TONE_AND_VOICE_RULES = [
  'Every page should naturally weave in: this client\'s specific pain points, the business risk of not acting, the opportunities they stand to lose, the outcomes they can expect, the benefits and value on offer, a confident tone, and clear next steps. Do this naturally, in prose — never as a bullet-point checklist unless the field is explicitly an array.',
  'Avoid generic marketing language entirely. Never produce text that reads as "AI-generated" — no hollow superlatives, no filler, no content that could be copy-pasted into any other client\'s proposal unchanged.',
  'Write in British English. Tone: professional, executive, friendly, confident, consultative. No hype. No exaggerated promises — every claim must be grounded in the facts provided.',
  'You must NOT generate HTML. You must NOT generate Markdown. You must NOT generate JSX. You must NOT generate page layouts, components, or anything visual — plain text content only.',
]

export function buildContentSystemPromptCompact(identity: ProviderIdentity = 'novara'): string {
  const lines = [
    consultantPersona(identity),
    blueprintIntake(identity),
    'Your job is to transform these facts into a persuasive, page-mapped sales proposal — NOT generic copywriting from a template. Every proposal you write must feel like it was written specifically for this one client, using their own situation, industry, and language. This call covers every page EXCEPT 07 and 08, which are generated separately.',
    ...TONE_AND_VOICE_RULES,
    JSON_OBJECT_RESPONSE_ONLY,
    `The JSON object must have exactly these fields (nested as shown):\n${PAGE_SCHEMA_FIELDS_COMPACT.map((f) => `- ${withProviderName(f, identity)}`).join('\n')}`,
    LENGTH_DISCIPLINE_RULE,
    'Never omit a key. Never fabricate a fact not present in the Blueprint — if the Blueprint is thin on a topic, write a shorter, honest passage rather than inventing detail.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildContentSystemPromptPages0708(identity: ProviderIdentity = 'novara'): string {
  const lines = [
    consultantPersona(identity),
    blueprintIntake(identity),
    'Your job is to write ONLY pages 07 and 08 of the sales proposal — NOT generic copywriting from a template. Every field must feel like it was written specifically for this one client, using their own situation, industry, and language. The Blueprint below carries the same fields the field descriptions refer to as "intelligence.*" (commercial, competitors, opportunities, challenges, etc.) — read them directly off this Blueprint object.',
    ...TONE_AND_VOICE_RULES,
    JSON_OBJECT_RESPONSE_ONLY,
    `The JSON object must have exactly these fields (nested as shown):\n${PAGE_SCHEMA_FIELDS_0708.map((f) => `- ${withProviderName(f, identity)}`).join('\n')}`,
    LENGTH_DISCIPLINE_RULE,
    'Never omit a key. Never fabricate a fact not present in the Blueprint — if the Blueprint is thin on a topic, write a shorter, honest passage rather than inventing detail.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildContentSystemPromptPagesInsights(identity: ProviderIdentity = 'novara'): string {
  const lines = [
    consultantPersona(identity),
    blueprintIntake(identity),
    'Your job is to write ONLY the Business Intelligence pages (inserted after Page 07) of the sales proposal. This is where the client should immediately think "they\'ve really understood my business," not another page of service descriptions. Ground every field in the real facts on the Blueprint below (read them as "intelligence.*") — never generic industry commentary that could apply to any competitor in this space.',
    ...TONE_AND_VOICE_RULES,
    JSON_OBJECT_RESPONSE_ONLY,
    `The JSON object must have exactly these fields (nested as shown):\n${PAGE_SCHEMA_FIELDS_INSIGHTS.map((f) => `- ${withProviderName(f, identity)}`).join('\n')}`,
    LENGTH_DISCIPLINE_RULE,
    'Never omit a key. Never fabricate a fact not present in the Blueprint — if the Blueprint is thin on a topic, write a shorter, honest passage (or an empty array/string, per each field\'s own rules above) rather than inventing detail.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildContentUserPrompt(blueprint: ProposalBlueprint): string {
  return [
    'Proposal Blueprint (JSON):',
    '"""',
    JSON.stringify(blueprint, null, 2),
    '"""',
    'Generate the Sales Content now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}

/**
 * Page 07 only (see api/ai/generate-content.ts, which is the only caller
 * that attaches the web_search tool). Written to fit naturally into a
 * single turn alongside the JSON-only response contract every other page
 * already relies on — Claude is told exactly when to search, what to do
 * with what it finds, and — critically — to never let searching leak any
 * narration into the response, since tool-enabled turns otherwise tend to
 * add "I'll search for X first" preambles that would break JSON parsing.
 */
const WEB_RESEARCH_RULE = [
  'You have a web_search tool available. Before writing this page, use it to ground the situation/opportunity/keywords fields in real, current information rather than assumptions. The proposal must never depend on this client having a website — research the same three things either way, just by different means:',
  'If intelligence.client.website is non-empty:',
  '- Search for it (and the company name) to check what the site currently says and how it presents itself.',
  '- Search for the named competitors (intelligence.competitors) to see what they actually offer, how they position themselves, or what makes them visible.',
  "- Search for real, current search terms, local search behaviour, or industry trends relevant to this client's industry and location — this is what pages.page07.keywords should be grounded in, not guesswork.",
  'If intelligence.client.website is empty, do not try to guess or search for a URL. intelligence.client.industry and intelligence.client.businessType are always confirmed for this case (never blank) — use them instead:',
  '- Search the industry itself (intelligence.client.industry, intelligence.client.location) for current trends, typical customer behaviour, and what a business like this is normally judged on.',
  '- Search for likely competitors by industry + location (e.g. "[industry] companies in [location]") since none were named — look at how the strongest few present themselves.',
  '- Search for real local search terms a prospective customer of this business would actually type — this is what pages.page07.keywords should be grounded in, exactly as in the website case.',
  'Either way, if a search returns nothing useful, fall back to reasoning from the verified Proposal Intelligence alone, exactly as you would without search — never state or imply that research failed.',
  'Do this research silently as part of your own process. Your visible response must still be ONLY the JSON object described below — no preamble like "I will search for...", no explanation of what you found, no summary of your research, no source citations in the output text. Fold whatever you learn directly into the field values themselves.',
].join('\n')

/**
 * insightsGrowth only, per-page auto-flow — the actual research
 * instructions for what to search and what to do with it already live
 * inline on the marketIndustryPosition field description itself
 * (MARKET_RESEARCH_FIELD_RULE above); this is just the same "don't narrate
 * the tool use" guardrail WEB_RESEARCH_RULE gives page07, since a
 * tool-enabled turn otherwise tends to add a preamble that would break JSON
 * parsing.
 */
const SILENT_RESEARCH_INSTRUCTION =
  'You have a web_search tool available (see the marketIndustryPosition field description for what to research). Do this research silently as part of your own process — your visible response must still be ONLY the JSON object described below, no preamble like "I will search for...", no summary of what you found, no source citations in the output text. Fold whatever you learn directly into the field value itself.'

/**
 * `excludeLayouts` — page07 only. The auto-flow's Content Architect step
 * (blueprint/prompts.ts's buildDynamicPagePlanSystemPrompt) decides its
 * dynamic-page layouts BEFORE page07 is ever generated (see
 * autoGenerate.ts), so by the time this runs, every layout already
 * claimed by another page in this same proposal is already known. Without
 * this, page07's own independent layout choice (from the same 11-layout
 * menu) could pick the same layout as a dynamic page purely by
 * coincidence — e.g. both independently deciding "comparisonBars" is the
 * best fit for this client's retention/conversion data — producing two
 * near-identical visual blocks in the same document. Manual-flow page07
 * generation (buildContentSystemPromptPages0708) has no dynamic pages to
 * collide with, so it's untouched.
 */
export function buildContentSystemPromptForPage(
  pageId: string,
  excludeLayouts: Page07BlockLayout[] = [],
  identity: ProviderIdentity = 'novara',
): string {
  const fields = getPageFieldGroup(pageId)
  const providerName = getProviderName(identity)
  const lines = [
    `You are writing as a senior sales consultant at ${providerName}${identity === 'novara' ? ', a UK growth consultancy' : ''} — thinking simultaneously like a RevOps consultant, a growth strategist, a digital marketing consultant, and a business consultant.`,
    `You will be given structured Proposal Intelligence — verified facts about a prospective client (industry, business size, current situation, pain points, goals, timeline, budget, competitors, recommended services, and more), already confirmed by a ${providerName} team member. Treat every fact as ground truth.`,
    'Your job is to write ONLY the one page of persuasive sales copy described below — NOT generic copywriting from a template. It must feel like it was written specifically for this one client, using their own situation, industry, and language.',
    'Naturally weave in: this client\'s specific pain points, the business risk of not acting, the opportunities they stand to lose, the outcomes they can expect, a confident tone, and clear next steps. Write in prose — never as a bullet-point checklist unless the field is explicitly an array.',
    'Avoid generic marketing language entirely. Never produce text that reads as "AI-generated" — no hollow superlatives, no filler, no content that could be copy-pasted into any other client\'s proposal unchanged.',
    'Write in British English. Tone: professional, executive, friendly, confident, consultative. No hype. No exaggerated promises — every claim must be grounded in the facts provided.',
    'You must NOT generate HTML. You must NOT generate Markdown. You must NOT generate JSX. You must NOT generate page layouts, components, or anything visual — plain text content only.',
    ...(pageId === 'page07' ? [WEB_RESEARCH_RULE] : []),
    ...(pageId === 'insightsGrowth' ? [SILENT_RESEARCH_INSTRUCTION] : []),
    ...(pageId === 'page07' && excludeLayouts.length > 0
      ? [
          `This proposal already uses these visual layouts on other pages, with this exact same data already covered: ${excludeLayouts.join(', ')}. For pages.page07.enrichment, do NOT choose any of these layouts again — every visual layout in this proposal must appear at most once, unless it is presenting completely different data from a different angle. Pick a different layout from the remaining ones below, or return { blocks: [] } if none of the rest genuinely fit this client's data.`,
        ]
      : []),
    JSON_OBJECT_RESPONSE_ONLY,
    `The JSON object must have exactly these fields (nested as shown):\n${fields.map((f) => `- ${withProviderName(f, identity)}`).join('\n')}`,
    LENGTH_DISCIPLINE_RULE,
    'Never omit a key. Never fabricate a fact not present in the Proposal Intelligence — if it is thin on a topic, write a shorter, honest passage rather than inventing detail.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildContentUserPromptForPage(intelligence: ProposalIntelligence, proposal: BlueprintProposalContext): string {
  return [
    'Proposal metadata (JSON):',
    '"""',
    JSON.stringify(proposal, null, 2),
    '"""',
    'Verified Proposal Intelligence (JSON):',
    '"""',
    JSON.stringify(intelligence, null, 2),
    '"""',
    'Generate this one page\'s content now, following the exact JSON schema and rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}

/**
 * One AI-decided dynamic insight page (masterTemplate's dynamicInsight01..08
 * slots) — the topic, layout, and title are already fixed by the earlier
 * Content Architect step (see blueprint/prompts.ts's
 * buildDynamicPagePlanSystemPrompt); this call's only job is writing the
 * page's kicker label and the ONE visual block's content, pre-told exactly
 * which of the 11 layouts to use rather than Page07's own "pick up to two"
 * menu — simpler prompt, smaller response, matching this codebase's
 * established pattern of small/bounded calls over one large one.
 */
export function buildContentSystemPromptForDynamicPage(
  layout: Page07BlockLayout,
  title: string,
  identity: ProviderIdentity = 'novara',
): string {
  const providerName = getProviderName(identity)
  const lines = [
    `You are writing as a senior sales consultant at ${providerName}${identity === 'novara' ? ', a UK growth consultancy' : ''} — thinking simultaneously like a RevOps consultant, a growth strategist, a digital marketing consultant, and a business consultant.`,
    `You will be given structured Proposal Intelligence — verified facts about a prospective client (industry, business size, current situation, pain points, goals, timeline, budget, competitors, recommended services, and more), already confirmed by a ${providerName} team member. Treat every fact as ground truth.`,
    `Your job is to write ONE additional insight page for this proposal. Its topic and title — "${title}" — were already decided by an earlier planning step; you are not choosing or renaming the topic, only writing its content. The page shows a short kicker label above that title, followed by exactly one visual block using the "${layout}" layout.`,
    'Avoid generic marketing language entirely. Never produce text that reads as "AI-generated" — no hollow superlatives, no filler, no content that could be copy-pasted into any other client\'s proposal unchanged.',
    'Write in British English. Tone: professional, executive, friendly, confident, consultative. No hype. No exaggerated promises — every claim must be grounded in the facts provided.',
    'You must NOT generate HTML. You must NOT generate Markdown. You must NOT generate JSX — plain text/JSON field values only.',
    JSON_OBJECT_RESPONSE_ONLY,
    [
      'The JSON object must have exactly these fields:',
      `- kicker (string, ${constraintInstruction(FIELD_CONSTRAINTS['page07.kicker'])}) — a short label above the page title, e.g. "Business Intelligence"`,
      `- block (object) — the ONE visual block's content, matching the "${layout}" layout exactly. Populate only the fields matching this layout; leave every other field as an empty array/string: { layout: "${layout}", stats: [], beforeLabel: "", beforeText: "", afterLabel: "", afterText: "", roadmapSteps: [], opportunityCards: [], comparisonBars: [], funnelStages: [], stackedBarTitle: "", stackedBarSegments: [], treemapItems: [], projectionTitle: "", projectionUnit: "", projectionPoints: [], priorityMatrixXLabel: "", priorityMatrixYLabel: "", priorityMatrixItems: [], comparisonTableTitle: "", comparisonTableColumns: [], comparisonTableRows: [] }`,
      `Field guidance for the "${layout}" layout specifically: ${withProviderName(ENRICHMENT_LAYOUT_PROMPT_FRAGMENTS[layout], identity)}`,
    ].join('\n'),
    LENGTH_DISCIPLINE_RULE,
    'Never omit a key. Never fabricate a fact not present in the Proposal Intelligence — if it is thin on a topic, write a shorter, honest passage rather than inventing detail.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}
