// Vercel Serverless Function — consolidates the three "AI Proposal
// Generator" Phase 01-03 routes (formerly analyze-transcript.ts,
// find-missing-info.ts, generate-proposal-data.ts) into ONE function,
// dispatching on `action` in the request body. This is a pure
// infrastructure consolidation, not a behaviour change: each branch below
// is byte-for-byte the same logic that lived in its own file — same
// prompts, same coercion, same status codes, same error messages. Merged
// because the Vercel Hobby plan caps a deployment at 12 Serverless
// Functions, and this app's api/ directory had grown to 14; these three
// were the least-recently-changed, most naturally-sequential group (each
// literally the next step of the same pipeline) to combine into one.
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY

import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt, buildMissingInfoSystemPrompt, buildMissingInfoUserPrompt, buildProposalDataSystemPrompt, buildProposalDataUserPrompt } from '../../src/modules/analysis/prompts.js'
import { FOLLOW_UP_FIELD_KEYS } from '../../src/modules/analysis/fields.js'
import { emptyAnalysisFields, emptyProposalData, type FollowUpAnswers, type FollowUpQuestion, type ProposalData, type TranscriptAnalysisFields } from '../../src/modules/analysis/types.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'

// ─── Phase 01 — analyze ─────────────────────────────────────────────────

// Generous for a real meeting transcript, and well below anything that would
// meaningfully strain the model's context window — just a backstop so a
// pasted multi-hour recording's worth of text (or an abuse attempt) can't
// drive an unbounded API bill.
const MAX_TRANSCRIPT_LENGTH = 100_000

const ANALYSIS_STRING_KEYS: (keyof TranscriptAnalysisFields)[] = [
  'clientName', 'firstName', 'lastName', 'company', 'website', 'industry',
  'location', 'businessType', 'currentSituation', 'competition', 'budget',
  'timeline', 'decisionMaker', 'currentMarketing', 'additionalNotes',
]
const ANALYSIS_ARRAY_KEYS: (keyof TranscriptAnalysisFields)[] = [
  'servicesRequired', 'painPoints', 'goals', 'problems', 'recommendedServices',
]

function coerceAnalysis(raw: unknown): TranscriptAnalysisFields {
  const result = emptyAnalysisFields()
  if (!raw || typeof raw !== 'object') return result
  const obj = raw as Record<string, unknown>

  for (const key of ANALYSIS_STRING_KEYS) {
    const value = obj[key]
    if (typeof value === 'string') (result as unknown as Record<string, string>)[key] = value
  }
  for (const key of ANALYSIS_ARRAY_KEYS) {
    const value = obj[key]
    if (Array.isArray(value)) {
      ;(result as unknown as Record<string, string[]>)[key] = value.filter((v): v is string => typeof v === 'string')
    }
  }
  return result
}

async function handleAnalyze(apiKey: string, body: Record<string, unknown>, res: VercelResponse) {
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!transcript) {
    return res.status(400).json({ error: 'Missing required field: transcript' })
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return res.status(400).json({ error: 'Transcript is too long — please paste a shorter excerpt.' })
  }

  const text = await callClaude({
    apiKey,
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    system: buildAnalysisSystemPrompt(),
    userPrompt: buildAnalysisUserPrompt(transcript),
  })

  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch (e) {
    console.error('legacy-analysis.ts (analyze): failed to parse model response as JSON:', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
  }

  return res.status(200).json({ analysis: coerceAnalysis(parsed) })
}

// ─── Phase 02 — missingInfo ─────────────────────────────────────────────

const ALLOWED_FOLLOW_UP_KEYS = new Set(FOLLOW_UP_FIELD_KEYS)
const MAX_QUESTION_LENGTH = 300

function coerceQuestions(raw: unknown, existingAnswers: Record<string, unknown>): FollowUpQuestion[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: FollowUpQuestion[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const key = (item as Record<string, unknown>).key
    const question = (item as Record<string, unknown>).question
    if (typeof key !== 'string' || !ALLOWED_FOLLOW_UP_KEYS.has(key)) continue
    if (typeof question !== 'string' || !question.trim()) continue
    if (seen.has(key)) continue
    if (Object.prototype.hasOwnProperty.call(existingAnswers, key)) continue
    seen.add(key)
    result.push({ key, question: question.trim().slice(0, MAX_QUESTION_LENGTH) })
  }
  return result
}

async function handleMissingInfo(apiKey: string, body: Record<string, unknown>, res: VercelResponse) {
  if (!body?.analysis || typeof body.analysis !== 'object') {
    return res.status(400).json({ error: 'Missing required field: analysis' })
  }
  const existingAnswers = body.existingAnswers && typeof body.existingAnswers === 'object' ? (body.existingAnswers as FollowUpAnswers) : {}

  const text = await callClaude({
    apiKey,
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    system: buildMissingInfoSystemPrompt(),
    userPrompt: buildMissingInfoUserPrompt(body.analysis as TranscriptAnalysisFields, existingAnswers),
  })

  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch (e) {
    console.error('legacy-analysis.ts (missingInfo): failed to parse model response as JSON:', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
  }

  return res.status(200).json({ questions: coerceQuestions(parsed, existingAnswers) })
}

// ─── Phase 03 — proposalData ────────────────────────────────────────────

const PROPOSAL_DATA_STRING_KEYS: (keyof ProposalData)[] = ['clientName', 'companyName', 'website', 'industry', 'location', 'pricing', 'recommendation', 'cta', 'summary']
const PROPOSAL_DATA_ARRAY_KEYS: (keyof ProposalData)[] = ['painPoints', 'goals', 'services']

function coerceProposalData(raw: unknown): ProposalData {
  const result = emptyProposalData()
  if (!raw || typeof raw !== 'object') return result
  const obj = raw as Record<string, unknown>

  for (const key of PROPOSAL_DATA_STRING_KEYS) {
    const value = obj[key]
    if (typeof value === 'string') (result as unknown as Record<string, string>)[key] = value
  }
  for (const key of PROPOSAL_DATA_ARRAY_KEYS) {
    const value = obj[key]
    if (Array.isArray(value)) {
      ;(result as unknown as Record<string, string[]>)[key] = value.filter((v): v is string => typeof v === 'string')
    }
  }
  return result
}

async function handleProposalData(apiKey: string, body: Record<string, unknown>, res: VercelResponse) {
  if (!body?.analysis || typeof body.analysis !== 'object') {
    return res.status(400).json({ error: 'Missing required field: analysis' })
  }
  const transcript = typeof body.transcript === 'string' ? body.transcript : ''
  const followUpAnswers = body.followUpAnswers && typeof body.followUpAnswers === 'object' ? (body.followUpAnswers as FollowUpAnswers) : {}

  const text = await callClaude({
    apiKey,
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    system: buildProposalDataSystemPrompt(),
    userPrompt: buildProposalDataUserPrompt(transcript, body.analysis as TranscriptAnalysisFields, followUpAnswers),
  })

  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch (e) {
    console.error('legacy-analysis.ts (proposalData): failed to parse model response as JSON:', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
  }

  return res.status(200).json({ proposalData: coerceProposalData(parsed) })
}

// ─── Dispatch ────────────────────────────────────────────────────────────

type LegacyAnalysisAction = 'analyze' | 'missingInfo' | 'proposalData'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = (req.body as { action?: LegacyAnalysisAction } & Record<string, unknown>) || {}

  try {
    if (body.action === 'analyze') return await handleAnalyze(apiKey, body, res)
    if (body.action === 'missingInfo') return await handleMissingInfo(apiKey, body, res)
    if (body.action === 'proposalData') return await handleProposalData(apiKey, body, res)
    return res.status(400).json({ error: 'Missing or invalid required field: action (expected "analyze", "missingInfo", or "proposalData")' })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error(`legacy-analysis.ts (${body.action ?? 'unknown'}) fetch error:`, e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
