import { apiFetch } from './apiFetch.js'

/**
 * Fetches (minting if needed) the proposal's unique public share link —
 * backs the Send page's "Copy Link"/"Open Link" actions. Never sends an
 * email. Calls the same /api/proposals/send endpoint with `linkOnly: true`
 * rather than its own route — Vercel's Hobby plan caps a deployment at 12
 * Serverless Functions, and this project is already at that limit.
 */
export async function getShareLink(proposalId: string): Promise<string> {
  const res = await apiFetch('/api/proposals/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId, linkOnly: true }),
    authenticated: true,
  })

  let data: { error?: string; link?: string }
  try {
    data = await res.json()
  } catch {
    throw new Error('Something went wrong loading the share link. Please try again.')
  }
  if (!res.ok || !data.link) throw new Error(data.error || 'Failed to load share link')
  return data.link
}
