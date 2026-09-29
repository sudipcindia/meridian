import { isDynamicInsightPageId, type TemplatePageId, type DynamicInsightPageId } from './index.js'
import type { ProposalContentEnrichment, ProposalContentComparisonBar, ProposalContentOpportunityCard } from '../modules/salesContent/types.js'
import type { InsightsSwot, PricingCardRecord, InvestmentSplitSegment, DynamicInsightPageData } from '../modules/variables/index.js'
import type { ProviderIdentity } from '../modules/branding/identity.js'

/**
 * Everything a page might need as a real React prop (as opposed to
 * scalar text patched via resolvedBlocks/data-editor-key) — computed by
 * each render call site from its own already-loaded document/content, then
 * handed to this one shared lookup. Structured/variable-length content
 * (arrays, objects) can't be expressed as flat text, which is why these
 * exist as props at all — see LiveTemplatePreview.tsx's own doc comment.
 */
export interface PagePropsContext {
  page07Enrichment: ProposalContentEnrichment
  page07Keywords: string[]
  investmentSplit: InvestmentSplitSegment[]
  page08Cards: PricingCardRecord[]
  insightsBusinessCurrentPosition: ProposalContentComparisonBar[]
  insightsBusinessSwot: InsightsSwot
  insightsGrowthOpportunities: ProposalContentOpportunityCard[]
  /** Only the dynamicInsight0N ids actually present in this document's own `pages` array need an entry — see masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS. */
  dynamicInsightPages: Partial<Record<DynamicInsightPageId, DynamicInsightPageData>>
  /** Who this proposal represents as the provider/brand — read by page10/page11, whose "Novara"/"we" branding is hardcoded static JSX with no data-editor-key (see ProposalPage10Props/Page11Props). Optional and defaults to 'novara' wherever it's read, so omitting it keeps every existing render unchanged. */
  providerIdentity?: ProviderIdentity
}

/**
 * The single shared "which structured props does this page id need"
 * mapping — previously hand-duplicated as a near-identical ternary chain
 * across all 4 render call sites (ProposalEditor.tsx, ProposalReviewPage.tsx,
 * ClientProposalView.tsx, ProposalPdfView.tsx; a past bug was found and
 * fixed where PdfView was missing this for an existing page — this is the
 * fix for that class of bug happening again). Each site still computes its
 * own PagePropsContext locally from whatever data it already has —
 * content/contentOverrides parsing is unchanged — only the pageId → props
 * lookup itself is unified here, written once instead of four times.
 */
export function resolvePageProps(pageId: TemplatePageId, ctx: PagePropsContext): Record<string, unknown> | undefined {
  if (isDynamicInsightPageId(pageId)) {
    const page = ctx.dynamicInsightPages[pageId]
    if (!page) return undefined
    return { pageId, title: page.title, kicker: page.kicker, blocks: page.blocks, providerIdentity: ctx.providerIdentity ?? 'novara' }
  }
  switch (pageId) {
    case 'insightsBusiness':
      return { currentPosition: ctx.insightsBusinessCurrentPosition, swot: ctx.insightsBusinessSwot, providerIdentity: ctx.providerIdentity ?? 'novara' }
    case 'insightsGrowth':
      return { growthOpportunities: ctx.insightsGrowthOpportunities }
    case 'page08':
      return { cards: ctx.page08Cards }
    case 'page07':
      return { enrichment: ctx.page07Enrichment, keywords: ctx.page07Keywords, investmentSplit: ctx.investmentSplit, providerIdentity: ctx.providerIdentity ?? 'novara' }
    case 'cover':
    case 'page02':
    case 'page06':
    case 'page10':
    case 'page11':
      return { providerIdentity: ctx.providerIdentity ?? 'novara' }
    default:
      return undefined
  }
}

/** Builds the `dynamicInsightPages` slice of PagePropsContext by parsing whichever dynamicInsight0N ids are actually present in `pages` out of `contentOverrides` — shared by all four call sites so they can never drift into parsing this differently. */
export function resolveDynamicInsightPages(
  pages: readonly TemplatePageId[],
  contentOverrides: Record<string, string | undefined>,
  parseDynamicInsightPageOverride: (raw: string | undefined) => DynamicInsightPageData
): Partial<Record<DynamicInsightPageId, DynamicInsightPageData>> {
  const result: Partial<Record<DynamicInsightPageId, DynamicInsightPageData>> = {}
  for (const pageId of pages) {
    if (!isDynamicInsightPageId(pageId)) continue
    result[pageId] = parseDynamicInsightPageOverride(contentOverrides[pageId])
  }
  return result
}
