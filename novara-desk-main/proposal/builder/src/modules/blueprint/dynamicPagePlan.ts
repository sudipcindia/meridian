import { BLOCK_LAYOUTS } from '../salesContent/enrichmentBlocks.js'
import type { DynamicPagePlan, DynamicPagePlanEntry } from './types.js'

/** Hard ceiling — matches masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS (8 reserved slots). */
export const DYNAMIC_PAGE_PLAN_SOFT_CAP = 8

function coerceNestedObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

function coerceStringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Validates the Content Architect's decided plan defensively, same pattern
 * as every other AI-parsed value in this codebase: never trust raw model
 * output. Drops any entry with an unrecognized layout or empty
 * title/rationale (a genuinely malformed entry, not a real plan choice),
 * dedupes by layout (the prompt already asks for this but a stray repeat
 * must never make it through), and hard-caps at the soft-cap ceiling —
 * this is the one place a runaway/malformed response could otherwise
 * exceed the 8 reserved dynamicInsight page slots. Shared by both callers
 * of the Content Architect prompt (api/ai/generate-blueprint.ts's manual
 * Blueprint flow and api/ai/generate-content.ts's Meeting-Transcript
 * auto-flow) so the validation rules can never drift between the two.
 */
export function coerceDynamicPagePlan(raw: unknown): DynamicPagePlan {
  const obj = coerceNestedObject(raw)
  const rawPages = Array.isArray(obj.pages) ? obj.pages : []
  const seenLayouts = new Set<string>()
  const pages: DynamicPagePlanEntry[] = []

  for (const rawEntry of rawPages) {
    if (pages.length >= DYNAMIC_PAGE_PLAN_SOFT_CAP) break
    const entry = coerceNestedObject(rawEntry)
    const layout = coerceStringField(entry, 'layout')
    const title = coerceStringField(entry, 'title').trim()
    const rationale = coerceStringField(entry, 'rationale').trim()
    if (!BLOCK_LAYOUTS.includes(layout as (typeof BLOCK_LAYOUTS)[number])) continue
    if (!title || !rationale) continue
    if (seenLayouts.has(layout)) continue
    seenLayouts.add(layout)
    pages.push({ layout: layout as DynamicPagePlanEntry['layout'], title, rationale })
  }

  return { pages }
}
