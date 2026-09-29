import { supabaseServer } from '../supabaseServerClient.js'
import { generateShareToken } from './tokens.js'

/**
 * Returns the proposal's current active share token, minting one if it
 * doesn't have one yet. A proposal only ever has one active link at a
 * time — reused by both the email-send flow (api/proposals/send.ts) and
 * the standalone "get/copy the link" flow (api/proposals/share-link.ts),
 * so every proposal ends up with exactly one stable, unique public link
 * regardless of which action first created it.
 */
export async function ensureShareLinkToken(proposalId: string): Promise<string> {
  const { data: activeLink } = await supabaseServer
    .from('proposal_builder_share_links')
    .select('token')
    .eq('proposal_id', proposalId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeLink?.token) return activeLink.token as string

  const token = generateShareToken()
  const { error } = await supabaseServer.from('proposal_builder_share_links').insert({ proposal_id: proposalId, token })
  if (error) throw new Error(`Failed to create share link: ${error.message}`)
  return token
}

/** Builds the full public URL a client opens from the raw token, using the same deployment-URL resolution as api/pdf/generate.ts. */
export function buildShareLink(token: string): string {
  const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (!baseUrl) throw new Error('Could not determine deployment URL (VERCEL_URL not set)')
  return `${baseUrl}/p/${token}`
}
