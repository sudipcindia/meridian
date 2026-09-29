import { apiFetch } from '../../lib/apiFetch.js'
import type { AIGenerateRequest, AIGenerateResponse } from './types.js'

/**
 * Calls the Proposal Builder's own secure backend (proposal/builder/api/generate.ts)
 * — never Claude directly. No Anthropic API key is ever present in this file,
 * in any frontend bundle, or sent to the browser.
 *
 * Local dev note: this endpoint only exists once deployed on Vercel (or run
 * via `vercel dev` instead of `vite dev`) — a plain `npm run dev` Vite
 * server has no Vercel Functions runtime, so this call will 404 locally
 * under `vite dev`. Not a bug in this module; see the Phase 04 report.
 */
export async function generateAIContent(request: AIGenerateRequest): Promise<string> {
  const res = await apiFetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    authenticated: true,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(data.error || `AI request failed (${res.status})`)
  }

  const data = (await res.json()) as AIGenerateResponse
  return data.text
}
