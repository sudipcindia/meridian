import { apiFetch } from '../../lib/apiFetch.js'
import type { AnalyzeMeetingResponse, ProposalIntelligence } from './types.js'

/**
 * Calls the server-side analysis route — never Claude directly. No
 * Anthropic API key is ever present in this file (mirrors modules/ai/
 * client.ts and modules/analysis/client.ts).
 */
export async function analyzeMeeting(transcript: string): Promise<ProposalIntelligence> {
  const res = await apiFetch('/api/ai/analyze-meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ transcript }),
    // Matches the server's callClaude timeoutMs (analyze-meeting.ts) plus
    // headroom — apiFetch's 60s default would otherwise abort client-side
    // before the server's own 120s window ever gets used.
    timeoutMs: 130_000,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Analysis request failed (${res.status})`)
  return (data as AnalyzeMeetingResponse).intelligence
}
