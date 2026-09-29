import type { ProposalBlueprint } from '../blueprint/index.js'

/**
 * Proposal Intelligence Engine — Phase 05: Sales Content Engine. Turns the
 * Proposal Blueprint's structured facts (Phase 03 — client info, pain
 * points, goals, competitors, recommended services, strategy, etc.) into
 * persuasive, page-mapped proposal COPY. This object deliberately holds
 * only per-page content, never structured facts — those already live on
 * ProposalBlueprint and are never re-derived or duplicated here. Never
 * HTML, never Markdown, never JSX — plain text only, written into the
 * Builder's existing editable fields by Phase 04 (Builder Population),
 * which prefers this content when present and falls back to the
 * Blueprint's own page content otherwise.
 */

export interface ProposalContentPage01 {
  title: string
  tags: string[]
  introduction: string
}

export interface ProposalContentPage02 {
  companyUnderstanding: string
  welcomeMessage: string
  introParagraph: string
}

export interface ProposalContentStat {
  value: string
  label: string
}

export interface ProposalContentRoadmapStep {
  title: string
  description: string
}

export interface ProposalContentOpportunityCard {
  title: string
  description: string
}

/** One "current vs with Novara" dimension, scored 0-10 — Novara's own expert assessment, explicitly framed as such rather than measured analytics data. */
export interface ProposalContentComparisonBar {
  label: string
  currentScore: number
  targetScore: number
}

/** One funnel stage — `value` is a relative weight (widest = 100), not a claimed literal measured count unless the client's own figures genuinely support one. */
export interface ProposalContentFunnelStage {
  label: string
  value: number
}

export interface ProposalContentStackedBarSegment {
  label: string
  percent: number
}

export interface ProposalContentTreemapItem {
  label: string
  weight: number
}

export type Page07BlockLayout =
  | 'stats'
  | 'beforeAfter'
  | 'roadmap'
  | 'opportunityCards'
  | 'comparisonBars'
  | 'funnel'
  | 'stackedBar'
  | 'treemap'
  | 'projection'
  | 'priorityMatrix'
  | 'comparisonTable'

/** One point on a time-series projection/forecast (revenue, growth, ROI, etc. over time) — the one layout with a genuine time dimension; every other layout here is a single-snapshot comparison. */
export interface ProposalContentProjectionPoint {
  label: string
  value: number
}

/** One item plotted on a 2x2 priority matrix — x/y each 0-10, axis meaning defined per-block (e.g. Effort vs Impact). */
export interface ProposalContentPriorityMatrixItem {
  label: string
  x: number
  y: number
}

/** One row of a feature/commercial comparison table — `values` has exactly one entry per column after the label column. */
export interface ProposalContentComparisonTableRow {
  label: string
  values: string[]
}

/**
 * One AI-selected visual block on Page 07 — additive on top of the
 * guaranteed situation/opportunity paragraphs, never a replacement. Mirrors
 * `Page07EnrichmentBlock` in the frozen `ProposalPage07.tsx` structurally,
 * kept as a separate declaration rather than a cross-import so this content
 * layer stays decoupled from the template, matching how
 * `ProposalContentPricingCard` already mirrors `PricingCardData` without
 * importing it.
 */
export interface ProposalContentEnrichmentBlock {
  layout: Page07BlockLayout
  stats: ProposalContentStat[]
  beforeLabel: string
  beforeText: string
  afterLabel: string
  afterText: string
  roadmapSteps: ProposalContentRoadmapStep[]
  opportunityCards: ProposalContentOpportunityCard[]
  comparisonBars: ProposalContentComparisonBar[]
  funnelStages: ProposalContentFunnelStage[]
  stackedBarTitle: string
  stackedBarSegments: ProposalContentStackedBarSegment[]
  treemapItems: ProposalContentTreemapItem[]
  projectionTitle: string
  projectionUnit: string
  projectionPoints: ProposalContentProjectionPoint[]
  priorityMatrixXLabel: string
  priorityMatrixYLabel: string
  priorityMatrixItems: ProposalContentPriorityMatrixItem[]
  comparisonTableTitle: string
  comparisonTableColumns: string[]
  comparisonTableRows: ProposalContentComparisonTableRow[]
}

/** 0-2 AI-selected visual blocks — see ProposalContentEnrichmentBlock. Empty array means no extra block (the situation/opportunity paragraphs above already carry the narrative). */
export interface ProposalContentEnrichment {
  blocks: ProposalContentEnrichmentBlock[]
}

export interface ProposalContentPage07 {
  /** Shares one nowrap line with the client's first name (a separate template span) — kept short. */
  heading: string
  /** Replaces the static "SEO & Website Growth Proposal" kicker — adaptive so it reflects whatever strategy was actually recommended (SEO, brand, paid social, etc.), not always framed as SEO. */
  kicker: string
  description: string
  /** Replaces the static "[Business Name] has the demand..." paragraph. */
  situation: string
  /** Replaces the static "When buyers search for [service type] in [location]..." paragraph. */
  opportunity: string
  /** Replaces the static "The demand already exists. Here is where it is searching:" label — adaptive framing matching whatever `keywords` actually represents. */
  demandIntro: string
  /** Replaces the leftover "Security company Bristol"-style defaults with real, client-relevant terms. */
  keywords: string[]
  /** Always exactly 3 — the frozen template's funnel banner has a fixed 3-step layout with no prop to add/remove steps. */
  funnelSteps: string[]
  /** AI-selected visual block between "Where You Stand" and the demand keywords — see ProposalContentEnrichment. */
  enrichment: ProposalContentEnrichment
}

/**
 * Business Intelligence section — "Where You Stand Today", a premium page
 * inserted after Page 07 (never on the frozen Page 03, which is part of the
 * core template design system and stays static — see masterTemplate/index.ts
 * for the standing "new pages after Page07" rule). Grounded ONLY in real
 * ProposalBlueprint facts (transcript + questionnaire answers); never
 * fabricated. Any field left empty/short simply doesn't render on the page —
 * see buildInsightsBusinessContent's coercion.
 */
export interface ProposalContentInsightsBusiness {
  /** 2-4 sentences: who this business is, what it does, its scale — grounded in client/business facts, never generic. */
  businessOverview: string
  /** Current Position & Digital Maturity Assessment combined — reuses the exact ComparisonBar shape (current vs target, 0-10), Novara's own expert assessment, explicitly framed as such. 3-5 dimensions genuinely relevant to this client (e.g. Website, Marketing, Systems/CRM, Online Visibility). */
  currentPosition: ProposalContentComparisonBar[]
  /** Strengths/Weaknesses/Risks — each array only populated when real, defensible items exist; an empty array hides that column entirely rather than padding with filler. */
  swot: { strengths: string[]; weaknesses: string[]; risks: string[] }
}

/**
 * Business Intelligence section — "The Opportunity Ahead", a premium page
 * inserted after Page 07 (never on the frozen Page 04 — see
 * ProposalContentInsightsBusiness above). `marketIndustryPosition` is the one
 * field genuinely backed by real, persisted web research (see
 * buildContentSystemPromptPagesInsights's attached web_search tool) rather
 * than reasoning alone — it must say what was actually found, or fall back
 * to a shorter, more general statement if search turned up nothing useful.
 * Never invented specifics either way.
 */
export interface ProposalContentInsightsGrowth {
  /** Growth Opportunities + Missed Opportunities combined into one card grid — reuses the exact OpportunityCard shape from Page07. 3-4 cards, each grounded in real stated opportunities/goals. */
  growthOpportunities: ProposalContentOpportunityCard[]
  /** Market Potential + Industry Trends + Competitive Position combined into one paragraph. */
  marketIndustryPosition: string
  /** Where this business could be in 12-24 months if it acts — grounded in stated goals/timeline/recommended services, never a generic growth platitude. */
  futureGrowthPotential: string
}

/**
 * One AI-decided dynamic insight page — the generalization of
 * insightsBusiness/insightsGrowth into a variable-count set (see
 * masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS). Which of the 8
 * reserved dynamicInsight01.."08" slots below actually get one of these is
 * decided per-proposal by the Content Architect step of the
 * Meeting-Transcript auto-flow (modules/blueprint/types.ts's
 * DynamicPagePlan) — a proposal none of that flow ever ran for has all 8
 * fields undefined, identical to today.
 */
export interface ProposalContentDynamicInsightPage {
  title: string
  kicker: string
  /** 1-2 AI-selected visual blocks, same shape/rules as Page07's own enrichment slot (never two of the same layout). */
  blocks: ProposalContentEnrichmentBlock[]
}

export interface ProposalContentPricingCard {
  id: string
  title: string
  price: string
  priceSuffix: string
  /** Why this specific package fits this client — grounded in their pain points, not a generic sales line. */
  whyRecommended: string
  features: string[]
  /** What changes for the client once this package is delivered — grounded in their stated goals. */
  expectedOutcome: string
  /** '' unless the client's own commercial figures support a genuine calculation — never a fabricated statistic. */
  roiNote: string
  footerNote: string
}

export interface ProposalContentPage08 {
  investmentExplanation: string
  /** At least 2 cards — the frozen template's "combination box" is a fixed "A + B = outcome" element that structurally requires two packages to combine. */
  cards: ProposalContentPricingCard[]
  /** Which of `cards` (by id) the combination box's two package slots represent — their title/price/priceSuffix are copied verbatim, never independently generated, so the combo box can never disagree with the cards above it. */
  recommendedCardId: string
  complementaryCardId: string
  /** Combination box's two free-text lines — everything else in that box is derived from the two referenced cards. */
  outcomeLine: string
  resultsLine: string
  /** Informational only today — Page 08's packages are structured pricing cards with price/feature data this engine doesn't generate, so these descriptions have no existing Builder field yet (see modules/blueprintPopulate's "Not Yet Available" list). */
  packageDescriptions: string[]
}

export interface ProposalContentPage09 {
  /** Informational only today — Page 09 has no editable timeline/deliverables field in the Builder yet. */
  timeline: string
  deliverables: string[]
}

export interface ProposalContentPage11 {
  /** Informational only today — no dedicated Builder field beyond the envelope message. */
  closingMessage: string
  envelopeMessage: string
}

export interface ProposalContentPages {
  page01: ProposalContentPage01
  page02: ProposalContentPage02
  /** Page 05 — Recommended Strategy. */
  page05: string
  /** Page 06 — Delivery Roadmap. Informational only today — no single existing field can safely hold it (see modules/blueprintPopulate's "Not Yet Available" list). */
  page06: string
  /** Page 07 — Why Novara. */
  page07: ProposalContentPage07
  /** Premium page inserted after Page 07 — Business Intelligence: Where You Stand Today. */
  insightsBusiness: ProposalContentInsightsBusiness
  /** Premium page inserted after Page 07 — Business Intelligence: The Opportunity Ahead. */
  insightsGrowth: ProposalContentInsightsGrowth
  // 8 reserved dynamic-insight slots (see masterTemplate/index.ts's
  // DYNAMIC_INSIGHT_PAGE_IDS) — explicit optional fields rather than a
  // Partial<Record<...>>, matching this file's existing closed-shape style
  // and keeping autoGenerate.ts's shallow mergePageIntoContent untouched.
  // undefined for every proposal not built via the Content Architect step.
  dynamicInsight01?: ProposalContentDynamicInsightPage
  dynamicInsight02?: ProposalContentDynamicInsightPage
  dynamicInsight03?: ProposalContentDynamicInsightPage
  dynamicInsight04?: ProposalContentDynamicInsightPage
  dynamicInsight05?: ProposalContentDynamicInsightPage
  dynamicInsight06?: ProposalContentDynamicInsightPage
  dynamicInsight07?: ProposalContentDynamicInsightPage
  dynamicInsight08?: ProposalContentDynamicInsightPage
  page08: ProposalContentPage08
  page09: ProposalContentPage09
  page11: ProposalContentPage11
}

export interface ProposalContent {
  pages: ProposalContentPages
}

export function emptyProposalContent(): ProposalContent {
  return {
    pages: {
      page01: { title: '', tags: [], introduction: '' },
      page02: { companyUnderstanding: '', welcomeMessage: '', introParagraph: '' },
      page05: '',
      page06: '',
      page07: {
        heading: '',
        kicker: '',
        description: '',
        situation: '',
        opportunity: '',
        demandIntro: '',
        keywords: [],
        funnelSteps: [],
        enrichment: { blocks: [] },
      },
      insightsBusiness: { businessOverview: '', currentPosition: [], swot: { strengths: [], weaknesses: [], risks: [] } },
      insightsGrowth: { growthOpportunities: [], marketIndustryPosition: '', futureGrowthPotential: '' },
      page08: {
        investmentExplanation: '',
        cards: [],
        recommendedCardId: '',
        complementaryCardId: '',
        outcomeLine: '',
        resultsLine: '',
        packageDescriptions: [],
      },
      page09: { timeline: '', deliverables: [] },
      page11: { closingMessage: '', envelopeMessage: '' },
    },
  }
}

export interface GenerateContentRequest {
  blueprint: ProposalBlueprint
}

export interface GenerateContentResponse {
  content: ProposalContent
}
