// Vercel Serverless Function — staff-triggered: ensures a secure share
// link exists for a proposal, emails it to the client, and moves the
// proposal to "sent". Re-checks the approval gate server-side (not just a
// disabled UI button), matching the pattern already used by
// api/pdf/generate.ts (Phase 06).
//
// Also serves `{ linkOnly: true }` requests — just returns the proposal's
// share link, no email, no status change. This lives here rather than in
// its own file because the Vercel Hobby plan caps a deployment at 12
// Serverless Functions and this project is already at that limit; the
// link-only path reuses this function's existing auth/lookup/token logic
// rather than duplicating it in a 13th file.

import { supabaseServer } from '../_lib/supabaseServerClient.js'
import { ensureShareLinkToken, buildShareLink } from '../_lib/share/ensureShareLink.js'
import { sendEmail } from '../_lib/email/sendEmail.js'
import { logActivity } from '../_lib/activity/logActivity.js'
import { requireStaffAuth, StaffAuthError } from '../_lib/auth/requireStaffAuth.js'
import { SENDABLE_STATUSES, CLIENT_VIEWABLE_STATUSES } from '../../src/modules/status/gates.js'
import { getProviderName } from '../../src/modules/branding/identity.js'

interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Every code path below returns through `res.status(...).json(...)` — never
 * HTML, never a bare throw. The outer `handler` wraps this in a catch-all so
 * even a totally unexpected failure (a Supabase client construction error,
 * a bug, anything not already handled below) still comes back as JSON
 * rather than a platform-generated HTML/crash page.
 */
async function handleSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireStaffAuth(req)
  } catch (e) {
    if (e instanceof StaffAuthError) return res.status(e.status).json({ error: e.message })
    throw e
  }

  const body = req.body as { proposalId?: string; clientEmail?: string; linkOnly?: boolean }
  if (!body?.proposalId) return res.status(400).json({ error: 'Missing required field: proposalId' })

  if (body.linkOnly) {
    const { data: linkProposalRow, error: linkProposalError } = await supabaseServer
      .from('proposal_builder_proposals')
      .select('id, status')
      .eq('id', body.proposalId)
      .single()

    if (linkProposalError || !linkProposalRow) return res.status(404).json({ error: 'Proposal not found' })
    if (!CLIENT_VIEWABLE_STATUSES.includes(linkProposalRow.status)) {
      return res
        .status(400)
        .json({ error: `Proposal must be Approved before a share link is available — current status: ${linkProposalRow.status}` })
    }

    try {
      const token = await ensureShareLinkToken(linkProposalRow.id)
      return res.status(200).json({ link: buildShareLink(token) })
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create share link' })
    }
  }

  if (body.clientEmail && !EMAIL_PATTERN.test(body.clientEmail.trim())) {
    return res.status(400).json({ error: 'Invalid client email address' })
  }

  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, client_first_name, company_name, proposal_name, client_email, status, provider_identity')
    .eq('id', body.proposalId)
    .single()

  if (proposalError || !proposalRow) return res.status(404).json({ error: 'Proposal not found' })
  if (!SENDABLE_STATUSES.includes(proposalRow.status)) {
    return res.status(400).json({ error: `Proposal must be Ready (or Approved) before sending — current status: ${proposalRow.status}` })
  }

  const clientEmail = body.clientEmail?.trim() || proposalRow.client_email
  if (!clientEmail) return res.status(400).json({ error: 'Missing client email address' })
  if (!EMAIL_PATTERN.test(clientEmail)) return res.status(400).json({ error: 'Invalid client email address on file' })

  if (body.clientEmail && body.clientEmail.trim() !== proposalRow.client_email) {
    await supabaseServer.from('proposal_builder_proposals').update({ client_email: clientEmail }).eq('id', proposalRow.id)
  }

  let link: string
  try {
    const token = await ensureShareLinkToken(proposalRow.id)
    link = buildShareLink(token)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create share link' })
  }

  const providerName = getProviderName(proposalRow.provider_identity ?? 'novara')
  try {
    await sendEmail({
      to: clientEmail,
      subject: `${escapeHtml(proposalRow.proposal_name)} — ${providerName}`,
      html: `<p>Hi ${escapeHtml(proposalRow.client_first_name)},</p><p>Your proposal from ${escapeHtml(providerName)} is ready to view.</p><p><a href="${link}">View Your Proposal</a></p>`,
      fromName: providerName,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send email'
    console.error('proposals/send.ts: sendEmail failed:', message)
    // Recorded so UAT's "Email Success Rate" / "Failed Deliveries" metrics
    // (Phase 10) reflect real delivery failures, not just successes.
    void logActivity({ proposalId: proposalRow.id, action: 'email_failed', actor: 'staff', detail: message })
    return res.status(502).json({ error: 'Failed to send the proposal email. Please try again shortly.' })
  }

  const { error: statusUpdateError } = await supabaseServer
    .from('proposal_builder_proposals')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', proposalRow.id)
  if (statusUpdateError) {
    console.error('proposals/send.ts: status update failed after email was sent:', statusUpdateError.message)
  }

  void logActivity({ proposalId: proposalRow.id, action: 'email_sent', actor: 'staff', detail: clientEmail })

  return res.status(200).json({ ok: true, link })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleSend(req, res)
  } catch (e) {
    console.error('proposals/send.ts: unexpected error:', e instanceof Error ? e.stack ?? e.message : e)
    return res.status(500).json({ error: 'Something went wrong sending the proposal. Please try again.' })
  }
}
