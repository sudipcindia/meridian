import { supabaseServer } from '../supabaseServerClient.js'

export class ShareLinkError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface ResolvedShareLink {
  proposalId: string
}

/**
 * Resolves a client share token to a proposal id, checking revocation/
 * expiry — shared by both api/client/resolve.ts and api/client/accept.ts
 * so the validity rules live in exactly one place. Never called from
 * anywhere client-side; the anon key never has a path to this table that
 * would let it enumerate tokens.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShareLink> {
  const { data, error } = await supabaseServer
    .from('proposal_builder_share_links')
    .select('proposal_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) throw new ShareLinkError(404, 'Invalid or unknown link')
  if (data.revoked_at) throw new ShareLinkError(410, 'This link has been revoked')
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new ShareLinkError(410, 'This link has expired')
  }

  return { proposalId: data.proposal_id }
}
