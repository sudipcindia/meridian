import { apiFetch } from './apiFetch.js'
import type { TemplatePageId } from '../masterTemplate/index.js'
import type { ContentOverrideMap, VariableMap } from '../modules/variables/index.js'
import type { ProviderIdentity } from '../modules/branding/identity.js'

/**
 * Everything the public /p/:token view needs to render a proposal, as
 * returned by api/client/resolve.ts. Deliberately fetched over HTTP rather
 * than via the Supabase lib functions used elsewhere in the app — those go
 * through the anon-key client, which would let anyone enumerate proposals
 * by id. The client route only ever talks to the service-role-backed API.
 */
export interface ClientProposalData {
  proposalId: string
  documentId: string
  documentVersion: number
  pages: TemplatePageId[]
  variables: VariableMap
  contentOverrides: ContentOverrideMap
  clientFirstName: string
  proposalName: string
  companyName: string
  status: string
  alreadyAccepted: boolean
  /** null if the request didn't include a session id, or the tracking insert failed server-side (non-critical, never blocks loading the proposal). */
  viewId: string | null
  providerIdentity: ProviderIdentity
}

async function readJsonOrThrow(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export async function fetchClientProposal(token: string, sessionId?: string): Promise<ClientProposalData> {
  const query = sessionId
    ? `token=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionId)}`
    : `token=${encodeURIComponent(token)}`
  const res = await apiFetch(`/api/client/resolve?${query}`)
  return readJsonOrThrow(res)
}

export interface SubmitAcceptanceInput {
  token: string
  signerName: string
  company: string
  email: string
  phone: string
  method: 'drawn' | 'typed'
  signatureDataUrl?: string
  signatureText?: string
  consent: boolean
  // Best-effort browser-reported context for the audit trail (see
  // src/lib/deviceContext.ts) — never required, never blocks submission
  // when a given browser can't provide one.
  screenResolution?: string
  viewportSize?: string
  preferredLanguage?: string
  browserTimezone?: string
}

export async function submitAcceptance(input: SubmitAcceptanceInput): Promise<void> {
  // Longer timeout than the default: the server's own budget for this
  // endpoint is 60s (it may drive headless Chromium to stamp a signed PDF —
  // see vercel.json) — the client must wait at least that long before
  // giving up, so it doesn't report failure while the server is still
  // legitimately working.
  const res = await apiFetch('/api/client/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    timeoutMs: 90_000,
  })
  await readJsonOrThrow(res)
}
