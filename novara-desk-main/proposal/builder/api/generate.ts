// Vercel Serverless Function — generates/edits proposal content via Claude.
// Env var required (set in Vercel dashboard for this project): ANTHROPIC_API_KEY
//
// The API key lives ONLY here, server-side — the browser never sees it and
// it is never present in any frontend bundle. This mirrors the existing
// secure pattern already used by api/send-email.js and api/portal/*.js
// elsewhere in this repo (secret read via process.env, nothing returned to
// the client). Reuses the same model already used for Claude calls in the
// main Novara Desk app (claude-sonnet-4-6) rather than introducing a new
// provider or picking a different model unasked.
//
// All prompt-building logic lives in ../src/modules/ai/prompts.ts — this
// function only wires that shared logic to the Anthropic API and back.

import { buildSystemPrompt, buildUserPrompt } from '../src/modules/ai/prompts.js'
import { ensureAnthropicApiKey, ensureStaffAuth } from './_lib/ai/routeGuards.js'
import { callClaude, ClaudeApiError } from './_lib/ai/claudeClient.js'
import type { VercelRequest, VercelResponse } from './_lib/ai/types.js'
import type { AIGenerateRequest } from '../src/modules/ai/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await ensureStaffAuth(req, res))) return
  const apiKey = ensureAnthropicApiKey(res)
  if (!apiKey) return

  const request = req.body as AIGenerateRequest
  if (!request?.sectionId || !request?.action) {
    return res.status(400).json({ error: 'Missing required fields: sectionId, action' })
  }

  try {
    const text = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      maxTokens: 1024,
      system: buildSystemPrompt(request.providerIdentity ?? 'novara'),
      userPrompt: buildUserPrompt(request),
    })
    return res.status(200).json({ text })
  } catch (e) {
    if (e instanceof ClaudeApiError) return res.status(e.status).json({ error: e.message })
    console.error('generate.ts fetch error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to reach Claude API' })
  }
}
