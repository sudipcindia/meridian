// Vercel Serverless Function — Proposal Intelligence Engine, Phase 02.
// Inspects an already-saved ProposalIntelligence object and returns ONLY
// the minimum set of follow-up questions needed to fill genuine gaps —
// never proposal content, never a question about a field that already has
// a confirmed value. Nothing here is persisted — saving progress/answers
// is a separate, explicit client action (src/lib/intelligence.ts).
//
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
// Same key/model/raw-fetch pattern as api/ai/analyze-meeting.ts and every
// other AI route in this app — no Anthropic SDK, key never leaves this
// server-side function.

import { buildQuestionsSystemPrompt, buildQuestionsUserPrompt } from '../../src/modules/intelligence/questionPrompts.js'
import { emptyProposalIntelligence, type ProposalIntelligence } from '../../src/modules/intelligence/types.js'
import {
  INTELLIGENCE_TARGET_FIELDS,
  intelligenceFieldHasValue,
  type GeneratedQuestion,
  type IntelligenceTargetField,
  type QuestionAnswerType,
  type QuestionCategory,
} from '../../src/modules/intelligence/questionTypes.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from '../_lib/ai/routeGuards.js'
import { callClaude, extractJson, ClaudeApiError } from '../_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from '../_lib/ai/types.js'

const MAX_QUESTIONS = 10
const ALLOWED_TARGET_FIELDS = new Set<string>(INTELLIGENCE_TARGET_FIELDS)
const ALLOWED_CATEGORIES = new Set<string>(['business', 'marketing', 'sales', 'proposal'])
const ALLOWED_ANSWER_TYPES = new Set<string>(['short_text', 'paragraph', 'number', 'currency', 'date', 'dropdown', 'multi_select', 'yes_no'])

/** The client sends its own already-typed ProposalIntelligence, but this is still
 * an API boundary — merge onto the empty shape so a partial/malformed body can
 * never cause a crash below. */
function sanitizeIntelligenceInput(raw: unknown): ProposalIntelligence {
  const base = emptyProposalIntelligence()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  return {
    ...base,
    ...obj,
    client: { ...base.client, ...(obj.client && typeof obj.client === 'object' ? (obj.client as Record<string, unknown>) : {}) },
    business: { ...base.business, ...(obj.business && typeof obj.business === 'object' ? (obj.business as Record<string, unknown>) : {}) },
  } as ProposalIntelligence
}

/** Claude is instructed to return only a minimal, gap-filling JSON array, but
 * never trust that blindly — drop anything that isn't one of the allowed
 * fields, is a duplicate, or targets a field that already has a confirmed
 * value, and hard-cap the count. This is the real enforcement of "only ask
 * about genuinely missing information" and "no duplicate questions." */
function coerceQuestions(raw: unknown, intelligence: ProposalIntelligence): GeneratedQuestion[] {
  if (!Array.isArray(raw)) return []

  const seenFields = new Set<string>()
  const result: GeneratedQuestion[] = []

  for (const item of raw) {
    if (result.length >= MAX_QUESTIONS) break
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const targetField = typeof obj.targetField === 'string' ? obj.targetField : ''
    if (!ALLOWED_TARGET_FIELDS.has(targetField)) continue
    if (seenFields.has(targetField)) continue
    if (intelligenceFieldHasValue(intelligence, targetField as IntelligenceTargetField)) continue

    const question = typeof obj.question === 'string' ? obj.question.trim() : ''
    if (!question) continue

    const category: QuestionCategory = typeof obj.category === 'string' && ALLOWED_CATEGORIES.has(obj.category) ? (obj.category as QuestionCategory) : 'business'
    const answerType: QuestionAnswerType =
      typeof obj.answerType === 'string' && ALLOWED_ANSWER_TYPES.has(obj.answerType) ? (obj.answerType as QuestionAnswerType) : 'short_text'
    const options = Array.isArray(obj.options) ? obj.options.filter((o): o is string => typeof o === 'string') : []

    seenFields.add(targetField)
    result.push({
      id: `q_${result.length}_${targetField}`,
      category,
      question,
      answerType,
      options: answerType === 'dropdown' || answerType === 'multi_select' ? options : [],
      targetField: targetField as IntelligenceTargetField,
    })
  }

  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const body = req.body as { intelligence?: unknown } | undefined
  if (!body?.intelligence) {
    return res.status(400).json({ error: 'Missing required field: intelligence' })
  }
  const intelligence = sanitizeIntelligenceInput(body.intelligence)

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 2048,
      system: buildQuestionsSystemPrompt(),
      userPrompt: buildQuestionsUserPrompt(intelligence),
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch (e) {
      console.error('generate-questions.ts: failed to parse model response as JSON:', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'Could not read the AI\'s response. Please try again.' })
    }

    return res.status(200).json({ questions: coerceQuestions(parsed, intelligence) })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('generate-questions.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
