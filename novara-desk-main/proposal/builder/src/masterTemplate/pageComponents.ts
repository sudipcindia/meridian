import { lazy, type ComponentType } from 'react'
import type { TemplatePageId } from './index.js'

/**
 * Read-only render boundary onto the frozen master template. Each entry is a
 * lazy-loaded import of the actual approved page component — used ONLY to
 * render a live preview in the Proposal Editor. Most pages take no props at
 * all; a handful (e.g. Page 07's `keywords`) optionally accept a real,
 * already-defaulted prop so the Editor can drive variable-length repeatable
 * content (DOM patching alone can only rewrite existing nodes' text, never
 * add/remove nodes to match a changed array length). Nothing here ever
 * writes back to `proposal/components/proposal/`.
 */
export const TEMPLATE_PAGE_COMPONENTS: Record<TemplatePageId, ComponentType<any>> = {
  cover: lazy(() => import('@masterTemplateSrc/ProposalCover').then((m) => ({ default: m.ProposalCover }))),
  page02: lazy(() => import('@masterTemplateSrc/ProposalPage02').then((m) => ({ default: m.ProposalPage02 }))),
  page03: lazy(() => import('@masterTemplateSrc/ProposalPage03').then((m) => ({ default: m.ProposalPage03 }))),
  page04: lazy(() => import('@masterTemplateSrc/ProposalPage04').then((m) => ({ default: m.ProposalPage04 }))),
  page05: lazy(() => import('@masterTemplateSrc/ProposalPage05').then((m) => ({ default: m.ProposalPage05 }))),
  page06: lazy(() => import('@masterTemplateSrc/ProposalPage06').then((m) => ({ default: m.ProposalPage06 }))),
  page07: lazy(() => import('@masterTemplateSrc/ProposalPage07').then((m) => ({ default: m.ProposalPage07 }))),
  insightsBusiness: lazy(() => import('@masterTemplateSrc/ProposalPageInsightsBusiness').then((m) => ({ default: m.ProposalPageInsightsBusiness }))),
  insightsGrowth: lazy(() => import('@masterTemplateSrc/ProposalPageInsightsGrowth').then((m) => ({ default: m.ProposalPageInsightsGrowth }))),
  // All 8 reserved dynamic-insight slots share the same generic component —
  // see ProposalPageDynamicInsight.tsx and masterTemplate/index.ts's
  // DYNAMIC_INSIGHT_PAGE_IDS doc comment. A Record allows repeated values;
  // only the keys must be unique, so this still type-checks exhaustively.
  dynamicInsight01: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight02: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight03: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight04: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight05: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight06: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight07: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  dynamicInsight08: lazy(() => import('@masterTemplateSrc/ProposalPageDynamicInsight').then((m) => ({ default: m.ProposalPageDynamicInsight }))),
  page08: lazy(() => import('@masterTemplateSrc/ProposalPage08').then((m) => ({ default: m.ProposalPage08 }))),
  page09: lazy(() => import('@masterTemplateSrc/ProposalPage09').then((m) => ({ default: m.ProposalPage09 }))),
  page10: lazy(() => import('@masterTemplateSrc/ProposalPage10').then((m) => ({ default: m.ProposalPage10 }))),
  page11: lazy(() => import('@masterTemplateSrc/ProposalPage11').then((m) => ({ default: m.ProposalPage11 }))),
}
