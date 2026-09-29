import { DYNAMIC_INSIGHT_PAGE_IDS, type DynamicInsightPageId } from '../../masterTemplate/index.js'

/**
 * Single source of truth for the Meeting Transcript auto-flow's sequential,
 * page-by-page generation (see modules/intelligence/autoGenerate.ts). Only
 * the pages `buildPopulationSections` (mapping.ts) can actually populate
 * need a Claude call here — Page 06 and Page 09 have no safe existing
 * Builder field (see this module's own `getNotAvailableItems()`), and the
 * `variables`/`page10` sections are fully deterministic (no AI involved),
 * applied once up front rather than appearing in this list. Labels
 * intentionally match `mapping.ts`'s section `.label` strings.
 */

export const AUTO_GENERATE_PAGE_ORDER = ['cover', 'page02', 'page05', 'page07', 'page08', 'insightsBusiness', 'insightsGrowth', 'page11'] as const

export type BaseAutoGeneratePageId = (typeof AUTO_GENERATE_PAGE_ORDER)[number]

/** Widened to include the 0-8 AI-decided dynamicInsight0N slots the Content Architect step may add — see masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS. A dynamic id has no static label (its title comes from the decided DynamicPagePlanEntry, not this map) — see AUTO_GENERATE_PAGE_LABELS' own doc comment. */
export type AutoGeneratePageId = BaseAutoGeneratePageId | DynamicInsightPageId

export const AUTO_GENERATE_PAGE_LABELS: Record<BaseAutoGeneratePageId, string> = {
  cover: 'Cover',
  page02: 'Page 02 — Business Introduction',
  page05: 'Page 05 — Recommended Strategy',
  page07: 'Page 07 — Why Novara',
  page08: 'Page 08 — Investment',
  insightsBusiness: 'Business Insights — Where You Stand Today',
  insightsGrowth: 'Growth Insights — The Opportunity Ahead',
  page11: 'Page 11 — Closing',
}

/**
 * The full sequential generation order for one proposal, including
 * `dynamicPageCount` AI-decided insight pages inserted after
 * `insightsGrowth` and before `page11` — never hardcoded, since the count
 * varies per client (0-8, decided by the Content Architect step; see
 * blueprint/types.ts's DynamicPagePlan). `dynamicPageCount` is clamped to
 * the 8 reserved slots as a final defensive floor/ceiling, even though
 * coerceDynamicPagePlan already enforces this on the way in.
 */
export function buildAutoGeneratePageOrder(dynamicPageCount: number): AutoGeneratePageId[] {
  const clamped = Math.max(0, Math.min(dynamicPageCount, DYNAMIC_INSIGHT_PAGE_IDS.length))
  const dynamicIds = DYNAMIC_INSIGHT_PAGE_IDS.slice(0, clamped)
  const insightsGrowthIndex = AUTO_GENERATE_PAGE_ORDER.indexOf('insightsGrowth')
  return [
    ...AUTO_GENERATE_PAGE_ORDER.slice(0, insightsGrowthIndex + 1),
    ...dynamicIds,
    ...AUTO_GENERATE_PAGE_ORDER.slice(insightsGrowthIndex + 1),
  ]
}

/** A dynamicInsight0N id has no static label — its real name is whatever the Content Architect titled it (see blueprint/types.ts's DynamicPagePlanEntry), passed in here once known; falls back to a generic label before that title is available (e.g. very first progress event for a page not yet reached). */
export function getAutoGeneratePageLabel(pageId: AutoGeneratePageId, dynamicPageTitles?: Partial<Record<DynamicInsightPageId, string>>): string {
  if (Object.prototype.hasOwnProperty.call(AUTO_GENERATE_PAGE_LABELS, pageId)) {
    return AUTO_GENERATE_PAGE_LABELS[pageId as BaseAutoGeneratePageId]
  }
  return dynamicPageTitles?.[pageId as DynamicInsightPageId] || 'Additional Insight Page'
}
