import { apiFetch } from '../../lib/apiFetch.js'
import type { ProposalBlueprint } from '../blueprint/index.js'
import type { BusinessImpact, GenerateImpactResponse } from './types.js'

/**
 * Calls the server-side impact-calculation route — never Claude directly.
 * No Anthropic API key is ever present in this file (mirrors
 * modules/blueprint/client.ts and modules/salesContent/client.ts).
 */
export async function generateImpact(blueprint: ProposalBlueprint): Promise<BusinessImpact> {
  const res = await apiFetch('/api/ai/generate-impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ blueprint }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Impact calculation request failed (${res.status})`)
  return (data as GenerateImpactResponse).impact
}
