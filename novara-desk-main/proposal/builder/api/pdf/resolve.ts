// Vercel Serverless Function — resolves a proposal's print-ready content
// for ProposalPdfView.tsx. Mirrors api/client/resolve.ts exactly, but
// keyed by proposalId (not a share token) since the caller here is always
// the PDF engine's own headless Chromium, never a client.
//
// Required as a direct consequence of activating staff-only RLS this phase
// (see add_proposal_staff_auth.sql): Chromium has no Supabase Auth session,
// so the print-ready view can no longer read proposal_builder_* tables via
// the anon-key client. This endpoint uses supabaseServer (service-role
// key), which bypasses RLS entirely, exactly like every other server-only
// endpoint in this codebase.
//
// Phase 09 hardening: this route cannot require a user session (Chromium
// never has one), so it's protected two other ways instead — (1) a shared
// secret header that only our own engine.ts injects before navigating
// Chromium here, so a caller without it is rejected outright, and (2) a
// status gate (matching PDF generation's own PDF_VIEWABLE_STATUSES) so
// even a caller who somehow has the secret can never pull draft/unapproved
// content.

import { supabaseServer } from '../_lib/supabaseServerClient.js'
import { PDF_VIEWABLE_STATUSES } from '../../src/modules/status/gates.js'
import { computeDocumentHash } from '../_lib/audit/documentHash.js'
import { computeViewAnalytics, type ProposalView } from '../../src/modules/audit/viewAnalytics.js'

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

const RECENT_VIEWS_LIMIT = 25

function checkInternalSecret(req: VercelRequest, res: VercelResponse): boolean {
  const expectedSecret = process.env.PDF_INTERNAL_SECRET
  const providedSecretHeader = req.headers?.['x-pdf-internal-secret']
  const providedSecret = Array.isArray(providedSecretHeader) ? providedSecretHeader[0] : providedSecretHeader
  if (!expectedSecret || providedSecret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

async function handleResolveProposal(req: VercelRequest, res: VercelResponse) {
  const proposalId = typeof req.query?.id === 'string' ? req.query.id : undefined
  if (!proposalId) return res.status(400).json({ error: 'Missing id' })

  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, proposal_name, status, provider_identity')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposalRow) return res.status(404).json({ error: 'Proposal not found' })
  if (!PDF_VIEWABLE_STATUSES.includes(proposalRow.status)) {
    return res.status(403).json({ error: 'This proposal is not currently available for PDF rendering' })
  }

  const { data: documentRow, error: documentError } = await supabaseServer
    .from('proposal_builder_documents')
    .select('id, document_version, pages, variables, content_overrides')
    .eq('proposal_id', proposalId)
    .single()

  if (documentError || !documentRow) return res.status(404).json({ error: 'Proposal document not found' })

  return res.status(200).json({
    proposalId: proposalRow.id,
    proposalName: proposalRow.proposal_name,
    documentId: documentRow.id,
    documentVersion: documentRow.document_version,
    pages: documentRow.pages,
    variables: documentRow.variables,
    contentOverrides: documentRow.content_overrides,
    providerIdentity: proposalRow.provider_identity ?? 'novara',
  })
}

/**
 * Everything ProposalAuditReportView.tsx needs to render the downloadable
 * legal audit report. Folded into this same route (rather than a separate
 * api/audit/resolve.ts file) purely to stay under Vercel Hobby's 12
 * serverless-function-per-deployment cap — this project was already
 * sitting exactly at that limit. Deliberately has NO status gate unlike
 * handleResolveProposal above: an audit report is evidence of what
 * happened, producible for a signed OR unsigned proposal.
 */
async function handleResolveAuditReport(req: VercelRequest, res: VercelResponse) {
  const proposalId = typeof req.query?.id === 'string' ? req.query.id : undefined
  if (!proposalId) return res.status(400).json({ error: 'Missing id' })

  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, proposal_name, client_name, company_name, status, created_at')
    .eq('id', proposalId)
    .single()
  if (proposalError || !proposalRow) return res.status(404).json({ error: 'Proposal not found' })

  const { data: documentRow, error: documentError } = await supabaseServer
    .from('proposal_builder_documents')
    .select('id, document_version, pages, variables, content_overrides')
    .eq('proposal_id', proposalId)
    .single()
  if (documentError || !documentRow) return res.status(404).json({ error: 'Proposal document not found' })

  const { data: acceptanceRow } = await supabaseServer
    .from('proposal_builder_acceptances')
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  const { data: activityRows } = await supabaseServer
    .from('proposal_builder_activity')
    .select('action, actor, actor_name, detail, created_at')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  const { data: viewRows } = await supabaseServer
    .from('proposal_builder_views')
    .select('id, session_id, ip_address, user_agent, geo_country, geo_region, geo_city, viewed_at, duration_ms')
    .eq('proposal_id', proposalId)
    .order('viewed_at', { ascending: false })

  // Recomputed server-side, here, rather than trusting a client-supplied
  // value — the same integrity check ProposalDetail.tsx's
  // DocumentIntegrityBanner does client-side, so the report and the live
  // Overview page can never quietly disagree about whether the document
  // has changed.
  const currentDocumentHash = computeDocumentHash({
    pages: documentRow.pages,
    variables: documentRow.variables,
    contentOverrides: documentRow.content_overrides,
  })
  const documentModified = acceptanceRow?.document_hash ? currentDocumentHash !== acceptanceRow.document_hash : null

  // Signed URL for the drawn signature image, if any — generated
  // server-side (service-role) since Chromium has no session to fetch a
  // private-bucket file with, mirroring getSignatureImageUrl's staff-side
  // equivalent in src/lib/acceptances.ts.
  let signatureUrl: string | null = null
  if (acceptanceRow?.signature_path) {
    const { data: signedUrlData } = await supabaseServer.storage
      .from('proposal-signatures')
      .createSignedUrl(acceptanceRow.signature_path, 60 * 10)
    signatureUrl = signedUrlData?.signedUrl ?? null
  }

  const views: ProposalView[] = (viewRows ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    geoCountry: row.geo_country,
    geoRegion: row.geo_region,
    geoCity: row.geo_city,
    viewedAt: row.viewed_at,
    durationMs: row.duration_ms,
  }))
  const viewAnalytics = computeViewAnalytics(views, acceptanceRow?.accepted_at ?? null)

  return res.status(200).json({
    proposal: {
      id: proposalRow.id,
      proposalName: proposalRow.proposal_name,
      clientName: proposalRow.client_name,
      companyName: proposalRow.company_name,
      status: proposalRow.status,
      createdAt: proposalRow.created_at,
    },
    documentVersion: documentRow.document_version,
    documentIntegrity: {
      currentHash: currentDocumentHash,
      signedHash: acceptanceRow?.document_hash ?? null,
      modified: documentModified,
    },
    acceptance: acceptanceRow
      ? {
          signerName: acceptanceRow.signer_name,
          companyName: acceptanceRow.company_name,
          email: acceptanceRow.email,
          phone: acceptanceRow.phone,
          signatureMethod: acceptanceRow.signature_method,
          signaturePath: acceptanceRow.signature_path,
          signatureUrl,
          signatureText: acceptanceRow.signature_text,
          documentVersion: acceptanceRow.document_version,
          acceptedAt: acceptanceRow.accepted_at,
          ipAddress: acceptanceRow.ip_address,
          userAgent: acceptanceRow.user_agent,
          browserName: acceptanceRow.browser_name,
          browserVersion: acceptanceRow.browser_version,
          osName: acceptanceRow.os_name,
          osVersion: acceptanceRow.os_version,
          deviceType: acceptanceRow.device_type,
          screenResolution: acceptanceRow.screen_resolution,
          viewportSize: acceptanceRow.viewport_size,
          preferredLanguage: acceptanceRow.preferred_language,
          browserTimezone: acceptanceRow.browser_timezone,
          geoCountry: acceptanceRow.geo_country,
          geoRegion: acceptanceRow.geo_region,
          geoCity: acceptanceRow.geo_city,
          geoTimezone: acceptanceRow.geo_timezone,
          consentGiven: acceptanceRow.consent_given,
          consentText: acceptanceRow.consent_text,
        }
      : null,
    activity: (activityRows ?? []).map((row) => ({
      action: row.action,
      actor: row.actor,
      actorName: row.actor_name,
      detail: row.detail,
      createdAt: row.created_at,
    })),
    viewAnalytics,
    recentViews: views.slice(0, RECENT_VIEWS_LIMIT),
  })
}

/**
 * Every code path below returns through `res.status(...).json(...)` — never
 * HTML, never a bare throw. The outer `handler` wraps this in a catch-all
 * (matching api/proposals/send.ts's pattern) so even a totally unexpected
 * failure still comes back as JSON rather than a platform-generated
 * HTML/crash page.
 */
async function handleResolve(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!checkInternalSecret(req, res)) return

  const type = typeof req.query?.type === 'string' ? req.query.type : 'proposal'
  if (type === 'audit') return handleResolveAuditReport(req, res)
  return handleResolveProposal(req, res)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleResolve(req, res)
  } catch (e) {
    console.error('pdf/resolve.ts: unexpected error:', e instanceof Error ? e.stack ?? e.message : e)
    return res.status(500).json({ error: 'Something went wrong resolving this proposal. Please try again.' })
  }
}
