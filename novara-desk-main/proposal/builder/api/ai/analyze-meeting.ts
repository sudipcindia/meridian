// Vercel Serverless Function — Proposal Intelligence Engine, Phase 01.
// Analyses a meeting transcript (already extracted to plain text
// client-side, regardless of original file type) and returns ONLY
// structured business intelligence (see
// ../../src/modules/intelligence/types.ts). Never generates proposal
// pages, HTML, or Markdown, and never asks follow-up questions — a single,
// complete analysis pass only. Nothing here is persisted — saving is a
// separate, explicit client action (src/lib/intelligence.ts).
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
// Same key/model/raw-fetch pattern as api/generate.ts and every other AI
// route in this app — no Anthropic SDK, key never leaves this server-side
// function.

import { buildIntelligenceSystemPrompt, buildIntelligenceUserPrompt } from '../../src/modules/intelligence/prompts.js'
import { emptyProposalIntelligence, type ProposalIntelligence } from '../../src/modules/intelligence/types.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'

// Generous for a real meeting transcript (any source file was already
// converted to plain text before reaching this endpoint) — just a
// backstop against an unbounded API bill, same limit used by the earlier
// analyze-transcript.ts route.
const MAX_TRANSCRIPT_LENGTH = 100_000

const CLIENT_STRING_KEYS = ['firstName', 'lastName', 'fullName', 'company', 'email', 'website', 'industry', 'businessType', 'companySize', 'location'] as const
const BUSINESS_STRING_KEYS = ['currentSituation', 'currentMarketing', 'currentWebsite', 'existingCRM', 'existingAds', 'existingSEO'] as const
const TOP_STRING_KEYS = ['urgency', 'timeline', 'budget'] as const
const TOP_ARRAY_KEYS = ['goals', 'painPoints', 'challenges', 'objections', 'competitors', 'decisionMakers', 'recommendedServices', 'opportunities', 'missingInformation'] as const

function coerceStringObject<K extends string>(raw: unknown, keys: readonly K[]): Record<K, string> {
  const result = {} as Record<K, string>
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  for (const key of keys) {
    const value = obj[key]
    result[key] = typeof value === 'string' ? value : ''
  }
  return result
}

/** Claude is instructed to return only JSON, but never trust that blindly —
 * strip any accidental code fences, then coerce every field to its expected
 * type so a malformed/partial model response can never reach the client as
 * anything other than a valid ProposalIntelligence shape. */
function coerceIntelligence(raw: unknown): ProposalIntelligence {
  const result = emptyProposalIntelligence()
  if (!raw || typeof raw !== 'object') return result
  const obj = raw as Record<string, unknown>

  result.client = { ...result.client, ...coerceStringObject(obj.client, CLIENT_STRING_KEYS) }
  result.business = { ...result.business, ...coerceStringObject(obj.business, BUSINESS_STRING_KEYS) }

  for (const key of TOP_STRING_KEYS) {
    const value = obj[key]
    if (typeof value === 'string') (result as unknown as Record<string, string>)[key] = value
  }
  for (const key of TOP_ARRAY_KEYS) {
    const value = obj[key]
    if (Array.isArray(value)) {
      ;(result as unknown as Record<string, string[]>)[key] = value.filter((v): v is string => typeof v === 'string')
    }
  }
  if (typeof obj.confidenceScore === 'number' && Number.isFinite(obj.confidenceScore)) {
    result.confidenceScore = Math.max(0, Math.min(100, Math.round(obj.confidenceScore)))
  }

  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = req.body as { transcript?: string } | undefined
  const transcript = body?.transcript?.trim()
  if (!transcript) {
    return res.status(400).json({ error: 'Missing required field: transcript' })
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return res.status(400).json({ error: 'Transcript is too long — please paste a shorter excerpt.' })
  }

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      system: buildIntelligenceSystemPrompt(),
      userPrompt: buildIntelligenceUserPrompt(transcript),
      // Default 50s is too tight for a long transcript (up to
      // MAX_TRANSCRIPT_LENGTH chars) — same reasoning/timeout bump already
      // applied to generate-blueprint.ts and generate-content.ts.
      timeoutMs: 120_000,
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error('analyze-meeting.ts: failed to parse model response as JSON:', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    return res.status(200).json({ intelligence: coerceIntelligence(parsed) })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('analyze-meeting.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
