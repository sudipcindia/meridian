import { coerceEnrichmentBlocks } from '../salesContent/enrichmentBlocks.js'
import type { ProposalContentEnrichmentBlock } from '../salesContent/types.js'

export interface DynamicInsightPageData {
  title: string
  kicker: string
  /** 1-2 AI-selected visual blocks, same rules as Page07's own enrichment slot. */
  blocks: ProposalContentEnrichmentBlock[]
}

export const DEFAULT_DYNAMIC_INSIGHT_PAGE: DynamicInsightPageData = { title: '', kicker: '', blocks: [] }

/** Backfills a stored dynamicInsight0N blob to the full shape — same reasoning as normalizeEnrichment: JSON.parse has no shape validation. Delegates block coercion to the same shared module Page07's own enrichment slot uses. */
export function normalizeDynamicInsightPage(raw: unknown): DynamicInsightPageData {
  if (!raw || typeof raw !== 'object') return DEFAULT_DYNAMIC_INSIGHT_PAGE
  const obj = raw as Record<string, unknown>
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    kicker: typeof obj.kicker === 'string' ? obj.kicker : '',
    blocks: Array.isArray(obj.blocks) ? coerceEnrichmentBlocks(obj.blocks, 2) : [],
  }
}

/**
 * Parses one `dynamicInsight0N` contentOverride — a single JSON object
 * (`{ title, kicker, blocks }`), not a `parseCollection` array, mirroring
 * `page07.enrichment`'s own storage shape. The one parse path all four
 * render call sites should share, per the same reasoning documented on
 * `parseEnrichmentOverride`/`parseSwotOverride`.
 */
export function parseDynamicInsightPageOverride(raw: string | undefined): DynamicInsightPageData {
  if (!raw) return DEFAULT_DYNAMIC_INSIGHT_PAGE
  try {
    return normalizeDynamicInsightPage(JSON.parse(raw))
  } catch {
    return DEFAULT_DYNAMIC_INSIGHT_PAGE
  }
}
