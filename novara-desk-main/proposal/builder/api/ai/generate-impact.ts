// Vercel Serverless Function — Proposal Intelligence Engine, Phase 06.
// Calculates structured commercial projections (lead growth, revenue
// growth, conversion improvement, ROI, etc.) from a verified Proposal
// Blueprint (Phase 03) — never HTML, never CSS, never a React component,
// never a write to any Proposal Builder table. Nothing here is
// persisted — saving is a separate, explicit client action
// (src/lib/businessImpact.ts).
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
// Same key/model/raw-fetch pattern as every other AI route in this app —
// no Anthropic SDK, key never leaves this server-side function.

import { buildImpactSystemPrompt, buildImpactUserPrompt } from '../../src/modules/businessImpact/prompts.js'
import { emptyBusinessImpact, type BusinessImpact, type ConfidenceLevel, type DataQuality, type ImpactMetric } from '../../src/modules/businessImpact/types.js'
import { emptyProposalBlueprint, type ProposalBlueprint } from '../../src/modules/blueprint/types.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'

const METRIC_KEYS = [
  'leadGrowth',
  'revenueGrowth',
  'lostOpportunities',
  'conversionImprovement',
  'marketingEfficiency',
  'pipelineImprovement',
  'operationalTimeSavings',
  'salesProcessImprovement',
  'customerAcquisitionImprovement',
  'potentialROI',
] as const

const ALLOWED_CONFIDENCE = new Set<string>(['high', 'medium', 'low'])
const ALLOWED_DATA_QUALITY = new Set<string>(['known', 'estimated', 'assumed'])

function sanitizeBlueprintInput(raw: unknown): ProposalBlueprint {
  const base = emptyProposalBlueprint()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  return { ...base, ...obj } as ProposalBlueprint
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

/** Claude is instructed to return only JSON following strict safety rules, but
 * never trust that blindly — coerce every field to its expected type/enum so a
 * malformed or over-confident model response can never reach the client as
 * anything other than a valid, defensively-typed BusinessImpact shape. */
function coerceMetric(raw: unknown, fallbackLabel: string): ImpactMetric {
  const obj = coerceNestedObject(raw)
  const label = coerceStringField(obj, 'label') || fallbackLabel
  const currentValue = coerceStringField(obj, 'currentValue')
  const projectedValue = coerceStringField(obj, 'projectedValue')
  const estimatedChange = coerceStringField(obj, 'estimatedChange')
  const confidence: ConfidenceLevel = ALLOWED_CONFIDENCE.has(obj.confidence as string) ? (obj.confidence as ConfidenceLevel) : 'low'
  const dataQuality: DataQuality = ALLOWED_DATA_QUALITY.has(obj.dataQuality as string) ? (obj.dataQuality as DataQuality) : 'assumed'
  const assumptions = coerceStringArrayField(obj, 'assumptions')

  return {
    label,
    currentValue,
    projectedValue,
    estimatedChange,
    confidence,
    // Never allow an unlabelled "known" claim with no supporting data — if the model marked
    // something "known" but supplied neither a current value nor any assumption trail, treat
    // it as "assumed" so nothing masquerades as verified client data by mistake.
    dataQuality: dataQuality === 'known' && !currentValue ? 'assumed' : dataQuality,
    assumptions,
  }
}

function coerceImpact(raw: unknown): BusinessImpact {
  const result = emptyBusinessImpact()
  if (!raw || typeof raw !== 'object') return result
  const obj = raw as Record<string, unknown>

  for (const key of METRIC_KEYS) {
    result[key] = coerceMetric(obj[key], result[key].label)
  }
  result.overallSummary = coerceStringField(obj, 'overallSummary')

  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = req.body as { blueprint?: unknown } | undefined
  if (!body?.blueprint) {
    return res.status(400).json({ error: 'Missing required field: blueprint' })
  }
  const blueprint = sanitizeBlueprintInput(body.blueprint)

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      system: buildImpactSystemPrompt(blueprint.variables.providerIdentity ?? 'novara'),
      userPrompt: buildImpactUserPrompt(blueprint),
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error('generate-impact.ts: failed to parse model response as JSON:', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    return res.status(200).json({ impact: coerceImpact(parsed) })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('generate-impact.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
