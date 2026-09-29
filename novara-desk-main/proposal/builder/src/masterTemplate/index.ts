/**
 * The Novara master proposal template.
 *
 * There is exactly ONE master template design, and it is frozen. The
 * Proposal Editor (Phase 03) imports the 11 approved page components under
 * `proposal/components/proposal/` read-only for its live preview (see
 * `masterTemplate/pageComponents.ts`) — no props are ever passed beyond
 * what each component already optionally accepts, and nothing ever writes
 * back to those files. Every client proposal is created as its own
 * duplicated Document instance derived from this constant.
 *
 * `version` bumps only if the frozen template design itself is ever
 * deliberately revised (a rare, explicit event) — it is unrelated to how
 * many times an individual client's document has been edited (see
 * `documentVersion` in `types/document.ts`).
 */

/**
 * Checklist for adding a genuinely new page component to the roster (not
 * just editing an existing one) — per the standing rule that the proposal
 * is a dynamic document: when a future task needs content that doesn't fit
 * an existing page, add a new one here rather than cramming it in. Page
 * *numbers* are never hardcoded (see `computePageNumbers` below and
 * `ProposalLogo.tsx`'s text-rendered `PageNumber`), so a new entry anywhere
 * in this array automatically renumbers everything after it — but the
 * following touch-points still need a matching entry by hand:
 *
 * 1. Add the new id to this array, in the position it should appear.
 * 2. Create the frozen component under proposal/components/proposal/ and
 *    register it in masterTemplate/pageComponents.ts's TEMPLATE_PAGE_COMPONENTS.
 * 3. Add a short label for it in PageNavigator.tsx's PAGE_LABELS.
 * 4. If it carries AI-generated content: add its field group to
 *    modules/salesContent/prompts.ts, a coercion branch in
 *    api/ai/generate-content.ts, a mapping.ts section, and — if it's part of
 *    the Meeting-Transcript auto-flow — an entry in
 *    modules/blueprintPopulate/pageOrder.ts / api/ai/generate-content.ts's
 *    AUTO_GENERATE_PAGE_IDS.
 * 5. If it has structured (non-scalar) content: add the same `pageProps`
 *    computation + prop to ALL FOUR render call sites — ProposalEditor.tsx,
 *    ProposalReviewPage.tsx, ClientProposalView.tsx, AND ProposalPdfView.tsx
 *    (a real bug was found and fixed where PdfView was missing this for
 *    existing pages — don't repeat it for a new one).
 * 6. Existing proposals' `document.pages` arrays are NOT retroactively
 *    changed — a new page only appears on proposals created after it's
 *    added (or ones explicitly migrated), matching how `document.pages` has
 *    always worked (see lib/documents.ts).
 */
/**
 * 8 reserved slots for AI-decided, variable-count "Business Intelligence"
 * pages (soft cap: proposals typically use 2-4; hard ceiling: 8, never
 * padded to hit a number) — the direct generalization of insightsBusiness/
 * insightsGrowth below into an open-ended-feeling but still type-safe set.
 * Deliberately a CLOSED set of 8 literal ids rather than an open string
 * type: the hard ceiling makes the id space enumerable, so
 * TEMPLATE_PAGE_COMPONENTS can stay an exhaustive Record and every existing
 * page id keeps full compile-time checking — only these 8 slots are "extra."
 * All 8 render via the same generic ProposalPageDynamicInsight component
 * (see pageComponents.ts); which ones (if any) actually appear in a given
 * document.pages array is decided per-proposal by the Content Architect
 * step of the Meeting-Transcript auto-flow (modules/intelligence/
 * autoGenerate.ts) — see insertDynamicInsightPages below for the one write
 * path. A document with none of these ids present behaves identically to
 * today.
 */
export const DYNAMIC_INSIGHT_PAGE_IDS = [
  'dynamicInsight01',
  'dynamicInsight02',
  'dynamicInsight03',
  'dynamicInsight04',
  'dynamicInsight05',
  'dynamicInsight06',
  'dynamicInsight07',
  'dynamicInsight08',
] as const

export type DynamicInsightPageId = (typeof DYNAMIC_INSIGHT_PAGE_IDS)[number]

export function isDynamicInsightPageId(id: TemplatePageId): id is DynamicInsightPageId {
  return (DYNAMIC_INSIGHT_PAGE_IDS as readonly string[]).includes(id)
}

/**
 * The full canonical page ORDER — every frozen/fixed page plus all 8
 * reserved dynamic slots, in the position each would appear if present.
 * This is what TemplatePageId derives from (so the 8 dynamic ids get full
 * compile-time support everywhere a TemplatePageId is expected), and what
 * PageNavigator.tsx intersects a document's own `pages` against to derive
 * display order — exactly the mechanism insightsBusiness/insightsGrowth
 * already relied on, now extended to the 8 dynamic slots too.
 */
export const ALL_TEMPLATE_PAGE_IDS = [
  'cover',
  'page02',
  'page03',
  'page04',
  'page05',
  'page06',
  'page07',
  // Premium, AI-generated Business Intelligence pages — inserted here rather
  // than squeezed into Page03/04 (which are frozen core template pages, part
  // of the design system, and never repurposed for dynamic content). This is
  // the standing pattern for all future premium/value-added content
  // (deeper analysis, market/growth insight, GUI sections, infographics,
  // roadmaps, charts, ROI calculators, etc.): add a new page ID here, after
  // Page07 and before Page08, never edit an existing frozen page's layout.
  'insightsBusiness',
  'insightsGrowth',
  ...DYNAMIC_INSIGHT_PAGE_IDS,
  'page08',
  'page09',
  'page10',
  'page11',
] as const

export type TemplatePageId = (typeof ALL_TEMPLATE_PAGE_IDS)[number]

/**
 * The default page set for a brand-new document — every dynamic slot
 * excluded, since none is inserted until the Content Architect step
 * (autoGenerate.ts) explicitly decides a proposal earns some via
 * insertDynamicInsightPages. Named distinctly from ALL_TEMPLATE_PAGE_IDS
 * (which includes the dynamic slots for typing purposes) to keep "the pages
 * a new document actually starts with" and "every id the type system
 * knows about" from being silently conflated.
 */
export const MASTER_TEMPLATE_PAGES = ALL_TEMPLATE_PAGE_IDS.filter(
  (id): id is Exclude<TemplatePageId, DynamicInsightPageId> => !isDynamicInsightPageId(id)
)

export const MASTER_TEMPLATE = {
  id: 'novara-revops-master',
  version: 1,
  pages: MASTER_TEMPLATE_PAGES,
  readonly: true,
} as const

/**
 * The one place a document's `pages` array is ever given dynamic-insight
 * ids — a pure splice, always immediately after 'insightsGrowth' (falling
 * back to right after 'page07' if insightsGrowth is somehow absent, so this
 * never silently no-ops). Callers (autoGenerate.ts) are responsible for
 * persisting the result and bumping documentVersion in the same write —
 * see lib/documents.ts's setDynamicInsightPages.
 */
export function insertDynamicInsightPages(
  pages: readonly TemplatePageId[],
  ids: readonly DynamicInsightPageId[]
): TemplatePageId[] {
  // Always re-derive from a dynamic-id-free base first (rather than
  // inserting relative to whatever's already there) so calling this twice
  // — e.g. a resumed auto-flow re-deciding the plan — replaces the dynamic
  // segment instead of accumulating duplicates or drifting position.
  const withoutDynamic = pages.filter((id) => !isDynamicInsightPageId(id))
  if (ids.length === 0) return withoutDynamic
  const anchor = withoutDynamic.includes('insightsGrowth') ? 'insightsGrowth' : 'page07'
  const anchorIndex = withoutDynamic.indexOf(anchor)
  const insertAt = anchorIndex === -1 ? withoutDynamic.length : anchorIndex + 1
  return [...withoutDynamic.slice(0, insertAt), ...ids, ...withoutDynamic.slice(insertAt)]
}

/**
 * The single source of truth for "what number is this page" — always
 * derived from a document's actual page order (1-based), never hardcoded.
 * Inserting/removing/reordering entries in a `document.pages` array
 * automatically renumbers everything from here on; nothing else needs to
 * change. See ProposalLogo.tsx's `PageNumber` (text-rendered, not baked
 * into a per-page image) and the four render call sites that pass the
 * result in as a prop.
 */
export function computePageNumbers(pages: readonly TemplatePageId[]): Record<TemplatePageId, number> {
  const result = {} as Record<TemplatePageId, number>
  pages.forEach((id, i) => {
    result[id] = i + 1
  })
  return result
}
