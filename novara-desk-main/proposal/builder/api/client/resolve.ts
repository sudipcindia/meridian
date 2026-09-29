// Vercel Serverless Function — resolves a client share token into the
// proposal content needed to render the client-facing view. Never called
// with the anon key; always goes through the service-role-backed
// supabaseServer, so a client can never enumerate share tokens by querying
// the table directly (the anon key has no path to this table at all in
// the client bundle).

import { resolveShareToken, ShareLinkError } from '../_lib/share/resolveToken.js'
import { supabaseServer } from '../_lib/supabaseServerClient.js'
import { logViewedDebounced } from '../_lib/activity/logActivity.js'
import { CLIENT_VIEWABLE_STATUSES } from '../../src/modules/status/gates.js'
import { extractClientRequestContext } from '../_lib/request/clientContext.js'

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

interface ViewDurationBody {
  viewId?: string
  durationMs?: number
}

const MAX_DURATION_MS = 24 * 60 * 60 * 1000 // 24h — a generous sanity cap, not a real limit on how long a tab could plausibly sit open

/**
 * Best-effort "how long was this view open" report from navigator.sendBeacon
 * on page unload/visibility change (see src/pages/ClientProposalView.tsx).
 * Folded into this route as a POST branch (GET above resolves the proposal)
 * rather than its own file — Vercel Hobby's 12-serverless-function cap was
 * already fully used by this project. Still public/unauthenticated like the
 * GET path — `viewId` is an opaque UUID only the legitimate page load that
 * created the row ever received, enough to prevent random tampering with an
 * unrelated proposal's data, but this is explicitly NOT a security boundary
 * — it's a best-effort analytics number, not evidence anything depends on
 * being tamper-proof. A browser can miss sending this entirely (backgrounded
 * tab, killed process, blocked beacon), which is why "Average Time Spent" is
 * always presented as approximate in the UI.
 */
async function handleViewDuration(req: VercelRequest, res: VercelResponse) {
  const body = (req.body as ViewDurationBody) || {}
  if (!body.viewId || typeof body.viewId !== 'string') {
    return res.status(400).json({ error: 'Missing viewId' })
  }
  if (typeof body.durationMs !== 'number' || !Number.isFinite(body.durationMs) || body.durationMs < 0) {
    return res.status(400).json({ error: 'Invalid durationMs' })
  }
  const durationMs = Math.min(Math.round(body.durationMs), MAX_DURATION_MS)

  await supabaseServer.from('proposal_builder_views').update({ duration_ms: durationMs }).eq('id', body.viewId)

  // sendBeacon doesn't read the response body — this return value only
  // matters for direct testing/debugging of the endpoint itself.
  return res.status(200).json({ ok: true })
}

/**
 * Every code path below returns through `res.status(...).json(...)` — never
 * HTML, never a bare throw. The outer `handler` wraps this in a catch-all
 * (matching api/proposals/send.ts's pattern) so even a totally unexpected
 * failure on this public, unauthenticated endpoint still comes back as
 * JSON rather than a platform-generated HTML/crash page.
 */
async function handleResolve(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') return handleViewDuration(req, res)
  if (req.method !== 'GET') return res.status(405).end()

  const token = typeof req.query?.token === 'string' ? req.query.token : undefined
  if (!token) return res.status(400).json({ error: 'Missing token' })

  let proposalId: string
  try {
    ;({ proposalId } = await resolveShareToken(token))
  } catch (e) {
    if (e instanceof ShareLinkError) return res.status(e.status).json({ error: e.message })
    throw e
  }

  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, client_first_name, company_name, proposal_name, status, first_viewed_at, provider_identity')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposalRow) return res.status(404).json({ error: 'Proposal not found' })
  if (!CLIENT_VIEWABLE_STATUSES.includes(proposalRow.status)) {
    return res.status(403).json({ error: 'This proposal is not currently available to view' })
  }

  if (!proposalRow.first_viewed_at) {
    // Awaited, not fire-and-forget: supabase-js query builders are lazy
    // thenables that only issue the HTTP request once `.then()`/`await`
    // touches them — a bare `void query` here would silently never fire.
    // Wrapped in try/catch since a failure here must never break the
    // actual proposal content response below.
    try {
      await supabaseServer
        .from('proposal_builder_proposals')
        .update({ first_viewed_at: new Date().toISOString() })
        .eq('id', proposalId)
        .is('first_viewed_at', null)
    } catch (e) {
      console.error('client/resolve.ts: first_viewed_at update failed (non-critical):', e instanceof Error ? e.message : e)
    }
  }
  void logViewedDebounced(proposalId)

  // Raw, undebounced per-load view record for the audit trail's View &
  // Session Analytics — deliberately separate from logViewedDebounced
  // above (that stays 10-min-debounced for the human-readable Activity
  // tab). `session` is a client-generated id (sessionStorage, survives
  // reloads within one tab) — without one, this proposal's view simply
  // isn't tracked for analytics purposes rather than blocking the load.
  // Awaited (not fire-and-forget) because the client needs `viewId` back
  // to later report duration via the unload beacon — but wrapped so a
  // failure here can never fail the actual proposal content response.
  let viewId: string | null = null
  const sessionId = typeof req.query?.session === 'string' ? req.query.session : null
  if (sessionId) {
    try {
      const requestContext = extractClientRequestContext(req)
      const { data: viewRow } = await supabaseServer
        .from('proposal_builder_views')
        .insert({
          proposal_id: proposalId,
          session_id: sessionId,
          ip_address: requestContext.ipAddress,
          user_agent: requestContext.userAgent,
          geo_country: requestContext.geoCountry,
          geo_region: requestContext.geoRegion,
          geo_city: requestContext.geoCity,
        })
        .select('id')
        .single()
      viewId = viewRow?.id ?? null
    } catch (e) {
      console.error('client/resolve.ts: view tracking insert failed (non-critical):', e instanceof Error ? e.message : e)
    }
  }

  const { data: documentRow, error: documentError } = await supabaseServer
    .from('proposal_builder_documents')
    .select('id, document_version, pages, variables, content_overrides')
    .eq('proposal_id', proposalId)
    .single()

  if (documentError || !documentRow) return res.status(404).json({ error: 'Proposal document not found' })

  const { data: acceptanceRow } = await supabaseServer
    .from('proposal_builder_acceptances')
    .select('id')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  return res.status(200).json({
    proposalId: proposalRow.id,
    documentId: documentRow.id,
    documentVersion: documentRow.document_version,
    pages: documentRow.pages,
    variables: documentRow.variables,
    contentOverrides: documentRow.content_overrides,
    clientFirstName: proposalRow.client_first_name,
    proposalName: proposalRow.proposal_name,
    companyName: proposalRow.company_name,
    status: proposalRow.status,
    alreadyAccepted: Boolean(acceptanceRow),
    viewId,
    providerIdentity: proposalRow.provider_identity ?? 'novara',
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleResolve(req, res)
  } catch (e) {
    console.error('client/resolve.ts: unexpected error:', e instanceof Error ? e.stack ?? e.message : e)
    return res.status(500).json({ error: 'Something went wrong loading this proposal. Please try again.' })
  }
}
