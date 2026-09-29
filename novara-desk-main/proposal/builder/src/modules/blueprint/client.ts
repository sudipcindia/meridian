import { apiFetch } from '../../lib/apiFetch.js'
import type { ProposalIntelligence } from '../intelligence/index.js'
import type { BlueprintProposalContext, GenerateBlueprintResponse, ProposalBlueprint } from './types.js'

/**
 * Calls the server-side blueprint-generation route — never Claude
 * directly. No Anthropic API key is ever present in this file (mirrors
 * modules/intelligence/client.ts and modules/intelligence/questionsClient.ts).
 */
export async function generateBlueprint(proposal: BlueprintProposalContext, intelligence: ProposalIntelligence): Promise<ProposalBlueprint> {
  const res = await apiFetch('/api/ai/generate-blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ proposal, intelligence }),
    // Runs three parallel Claude calls server-side, each internally bounded
    // to 50s (api/_lib/ai/claudeClient.ts's own timeout) — the server
    // function itself now has a 120s budget (vercel.json), verified as
    // within this Vercel account's actual allowed range. The client needs
    // at least that much patience plus headroom for network/cold-start, or
    // it gives up before a legitimately-still-running request could ever
    // succeed.
    timeoutMs: 130_000,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Blueprint generation request failed (${res.status})`)
  return (data as GenerateBlueprintResponse).blueprint
}
