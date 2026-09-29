import type { Page07BlockLayout, ProposalContentEnrichmentBlock } from './types.js'
import { fitToConstraint } from './templateConstraints.js'

/**
 * The single shared implementation of "validate/coerce an AI-selected
 * enrichment block" — previously duplicated as two independent,
 * independently-drifting copies: api/ai/generate-content.ts's
 * coerceEnrichmentBlock (API-side, dropped invalid blocks) and
 * modules/variables/page07Fields.ts's normalizeEnrichmentBlock (Builder-side
 * re-hydration of a saved contentOverride, defaulted invalid blocks instead
 * of dropping them). Both call sites now import from here.
 *
 * Behaviour change from unifying: the Builder-side re-hydration path is now
 * as strict as the API-side one — a previously-saved block that never had
 * enough real data to satisfy blockHasRequiredData (e.g. a "stats" block
 * with fewer than 2 stats) will stop rendering on an old proposal, where it
 * previously rendered as a near-empty box. This is the correct behaviour
 * (an empty/degenerate block was never actually useful), but is a real,
 * deliberate change worth knowing about rather than a silent side effect.
 */
export const BLOCK_LAYOUTS: readonly Page07BlockLayout[] = [
  'stats',
  'beforeAfter',
  'roadmap',
  'opportunityCards',
  'comparisonBars',
  'funnel',
  'stackedBar',
  'treemap',
  'projection',
  'priorityMatrix',
  'comparisonTable',
]

/** Clamps to an integer 0-10 — Claude occasionally returns a float, a string, or an out-of-range score. */
export function coerceScore0to10(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, Math.round(n)))
}

/** Clamps to a non-negative integer — used for funnel stage weights and treemap item weights, which are relative sizing values, not bounded scores. */
export function coerceNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

/** Clamps to an integer 0-100 — stacked bar segment percentages. */
export function coercePercent(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** No clamp, unlike the helpers above — a projection point can be negative (e.g. a loss/decline forecast) or any real magnitude, only genuine non-finite input (NaN/Infinity/garbage) is rejected. */
export function coerceFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  return Number.isFinite(n) ? n : 0
}

function coerceStringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function coerceFittedStringField(obj: Record<string, unknown>, key: string, constraintKey: string): string {
  return fitToConstraint(constraintKey, coerceStringField(obj, key))
}

/**
 * Coerces every possible field of one raw block object to the full
 * ProposalContentEnrichmentBlock shape, regardless of which `layout` it
 * claims (only the layout's own fields end up populated in practice, since
 * that's all a well-formed input will contain) — always returns a complete,
 * safe object, never null. An invalid/missing `layout` falls back to
 * `'stats'`; combined with blockHasRequiredData below, a block with a
 * genuinely garbage layout+no matching data is filtered out by
 * coerceEnrichmentBlocks' own layout-membership check before this is ever
 * reached in that path, and a directly-called single-block use (Builder
 * re-hydration) still safely resolves to an empty-and-thus-rejected block.
 */
export function coerceEnrichmentBlockFields(raw: Record<string, unknown>): ProposalContentEnrichmentBlock {
  const layoutCandidate = typeof raw.layout === 'string' ? raw.layout : ''
  const layout = (BLOCK_LAYOUTS as readonly string[]).includes(layoutCandidate) ? (layoutCandidate as Page07BlockLayout) : 'stats'

  const stats = (Array.isArray(raw.stats) ? raw.stats : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      value: fitToConstraint('page07.enrichment.statValue', coerceStringField(s, 'value')),
      label: fitToConstraint('page07.enrichment.statLabel', coerceStringField(s, 'label')),
    }))
    .filter((s) => s.value.trim().length > 0)

  const roadmapSteps = (Array.isArray(raw.roadmapSteps) ? raw.roadmapSteps : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      title: fitToConstraint('page07.enrichment.roadmapTitle', coerceStringField(s, 'title')),
      description: fitToConstraint('page07.enrichment.roadmapDescription', coerceStringField(s, 'description')),
    }))
    .filter((s) => s.title.trim().length > 0)

  const opportunityCards = (Array.isArray(raw.opportunityCards) ? raw.opportunityCards : [])
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({
      title: fitToConstraint('page07.enrichment.opportunityCardTitle', coerceStringField(c, 'title')),
      description: fitToConstraint('page07.enrichment.opportunityCardDescription', coerceStringField(c, 'description')),
    }))
    .filter((c) => c.title.trim().length > 0)

  const comparisonBars = (Array.isArray(raw.comparisonBars) ? raw.comparisonBars : [])
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === 'object')
    .map((b) => ({
      label: fitToConstraint('page07.enrichment.comparisonBarLabel', coerceStringField(b, 'label')),
      currentScore: coerceScore0to10(b.currentScore),
      targetScore: coerceScore0to10(b.targetScore),
    }))
    .filter((b) => b.label.trim().length > 0)

  const funnelStages = (Array.isArray(raw.funnelStages) ? raw.funnelStages : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      label: fitToConstraint('page07.enrichment.funnelStageLabel', coerceStringField(s, 'label')),
      value: coerceNonNegativeInt(s.value),
    }))
    .filter((s) => s.label.trim().length > 0)

  const stackedBarTitle = fitToConstraint('page07.enrichment.stackedBarTitle', coerceStringField(raw, 'stackedBarTitle'))
  const stackedBarSegments = (Array.isArray(raw.stackedBarSegments) ? raw.stackedBarSegments : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      label: fitToConstraint('page07.enrichment.stackedBarSegmentLabel', coerceStringField(s, 'label')),
      percent: coercePercent(s.percent),
    }))
    .filter((s) => s.label.trim().length > 0 && s.percent > 0)

  const treemapItems = (Array.isArray(raw.treemapItems) ? raw.treemapItems : [])
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: fitToConstraint('page07.enrichment.treemapItemLabel', coerceStringField(it, 'label')),
      weight: coerceNonNegativeInt(it.weight),
    }))
    .filter((it) => it.label.trim().length > 0 && it.weight > 0)

  const projectionPoints = (Array.isArray(raw.projectionPoints) ? raw.projectionPoints : [])
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
    .map((p) => ({
      label: fitToConstraint('page07.enrichment.projectionPointLabel', coerceStringField(p, 'label')),
      value: coerceFiniteNumber(p.value),
    }))
    .filter((p) => p.label.trim().length > 0)

  const priorityMatrixItems = (Array.isArray(raw.priorityMatrixItems) ? raw.priorityMatrixItems : [])
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: fitToConstraint('page07.enrichment.priorityMatrixItemLabel', coerceStringField(it, 'label')),
      x: coerceScore0to10(it.x),
      y: coerceScore0to10(it.y),
    }))
    .filter((it) => it.label.trim().length > 0)

  const comparisonTableColumns = coerceStringArray(raw.comparisonTableColumns).map((c) =>
    fitToConstraint('page07.enrichment.comparisonTableColumn', c)
  )
  const comparisonTableRows = (Array.isArray(raw.comparisonTableRows) ? raw.comparisonTableRows : [])
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
    .map((r) => ({
      label: fitToConstraint('page07.enrichment.comparisonTableRowLabel', coerceStringField(r, 'label')),
      values: coerceStringArray(r.values)
        .map((v) => fitToConstraint('page07.enrichment.comparisonTableCell', v))
        // Every row must line up with the column count, or a cell silently
        // shifts under the wrong header — padded/truncated here rather than
        // trusted to the model getting array lengths right every time.
        .slice(0, Math.max(0, comparisonTableColumns.length - 1)),
    }))
    .filter((r) => r.label.trim().length > 0)
    .map((r) => ({
      ...r,
      values: [...r.values, ...Array(Math.max(0, comparisonTableColumns.length - 1 - r.values.length)).fill('')],
    }))

  return {
    layout,
    stats,
    beforeLabel: coerceFittedStringField(raw, 'beforeLabel', 'page07.enrichment.beforeAfterLabel'),
    beforeText: coerceFittedStringField(raw, 'beforeText', 'page07.enrichment.beforeAfterText'),
    afterLabel: coerceFittedStringField(raw, 'afterLabel', 'page07.enrichment.beforeAfterLabel'),
    afterText: coerceFittedStringField(raw, 'afterText', 'page07.enrichment.beforeAfterText'),
    roadmapSteps,
    opportunityCards,
    comparisonBars,
    funnelStages,
    stackedBarTitle,
    stackedBarSegments,
    treemapItems,
    projectionTitle: coerceFittedStringField(raw, 'projectionTitle', 'page07.enrichment.projectionTitle'),
    projectionUnit: fitToConstraint('page07.enrichment.projectionUnit', coerceStringField(raw, 'projectionUnit')),
    projectionPoints,
    priorityMatrixXLabel: coerceFittedStringField(raw, 'priorityMatrixXLabel', 'page07.enrichment.priorityMatrixAxisLabel'),
    priorityMatrixYLabel: coerceFittedStringField(raw, 'priorityMatrixYLabel', 'page07.enrichment.priorityMatrixAxisLabel'),
    priorityMatrixItems,
    comparisonTableTitle: coerceFittedStringField(raw, 'comparisonTableTitle', 'page07.enrichment.comparisonTableTitle'),
    comparisonTableColumns,
    comparisonTableRows,
  }
}

/** Whether a coerced block actually has enough real data to be worth rendering at all — the gate that decides "keep" vs "drop", one entry per layout. */
export function blockHasRequiredData(block: ProposalContentEnrichmentBlock): boolean {
  const hasRequiredData: Record<Page07BlockLayout, boolean> = {
    stats: block.stats.length >= 2,
    beforeAfter: block.beforeText.trim().length > 0 && block.afterText.trim().length > 0,
    roadmap: block.roadmapSteps.length >= 2,
    opportunityCards: block.opportunityCards.length >= 2,
    comparisonBars: block.comparisonBars.length >= 2,
    funnel: block.funnelStages.length >= 2,
    stackedBar: block.stackedBarTitle.trim().length > 0 && block.stackedBarSegments.length >= 2,
    treemap: block.treemapItems.length >= 3,
    // A 2-point "trend" is just a single before/after (already covered by
    // beforeAfter) — needs >=3 to actually read as a trajectory.
    projection: block.projectionPoints.length >= 3,
    priorityMatrix: block.priorityMatrixItems.length >= 3,
    comparisonTable: block.comparisonTableColumns.length >= 2 && block.comparisonTableRows.length >= 2,
  }
  return hasRequiredData[block.layout]
}

/**
 * Coerces a raw `blocks` array end to end: validates each entry's `layout`
 * is a real one, coerces its fields, drops anything that fails
 * blockHasRequiredData, de-duplicates by layout (never two blocks of the
 * same shape on one page), and caps at `maxBlocks` (2 for Page07's own
 * enrichment slot; 1-2 for a single dynamic-insight page).
 */
export function coerceEnrichmentBlocks(rawBlocks: unknown[], maxBlocks: number): ProposalContentEnrichmentBlock[] {
  const blocks: ProposalContentEnrichmentBlock[] = []
  const seenLayouts = new Set<string>()

  for (const rb of rawBlocks) {
    if (blocks.length >= maxBlocks) break
    if (!rb || typeof rb !== 'object') continue
    const raw = rb as Record<string, unknown>
    const layoutCandidate = typeof raw.layout === 'string' ? raw.layout : ''
    if (!(BLOCK_LAYOUTS as readonly string[]).includes(layoutCandidate)) continue
    if (seenLayouts.has(layoutCandidate)) continue
    const block = coerceEnrichmentBlockFields(raw)
    if (!blockHasRequiredData(block)) continue
    seenLayouts.add(block.layout)
    blocks.push(block)
  }

  return blocks
}
