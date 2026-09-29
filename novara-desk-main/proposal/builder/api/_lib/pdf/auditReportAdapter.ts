// Sibling to proposalPdfAdapter.ts — same renderUrlToPdf engine, but for
// the downloadable legal audit report instead of the client-facing
// proposal document. Two deliberate differences from the proposal PDF:
// (1) no status gate (an audit report is producible for any proposal,
// signed or not — it's evidence of what happened, not a client-facing
// deliverable), and (2) NEVER cached — activity/view data changes
// continuously, so a version-keyed cache (like the proposal PDF's) would
// go stale on the very next page view or activity event.

import { supabaseServer } from '../supabaseServerClient.js'
import { renderUrlToPdf } from './engine.js'
import { logActivity } from '../activity/logActivity.js'
import { buildFilename } from '../../../src/modules/pdf/index.js'

const PDF_BUCKET = 'proposal-pdfs'
const AUDIT_REPORT_FILENAME_TEMPLATE = '{clientName}_Audit_Report_{year}.pdf'

export interface AuditReportResult {
  filename: string
  url: string
}

export async function generateAuditReportPdf(proposalId: string, baseUrl: string, requestedByEmail: string): Promise<AuditReportResult> {
  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, client_name, company_name, proposal_name')
    .eq('id', proposalId)
    .single()
  if (proposalError || !proposalRow) throw new Error('Proposal not found')

  const filename = buildFilename(AUDIT_REPORT_FILENAME_TEMPLATE, {
    clientName: proposalRow.client_name,
    companyName: proposalRow.company_name,
    proposalName: proposalRow.proposal_name,
    year: new Date().getFullYear(),
  })

  const printUrl = `${baseUrl}/proposals/${proposalId}/audit-report-view`
  const internalSecret = process.env.PDF_INTERNAL_SECRET
  const { buffer } = await renderUrlToPdf({
    url: printUrl,
    extraHeaders: internalSecret ? { 'x-pdf-internal-secret': internalSecret } : undefined,
  })

  // Timestamped path, not version-keyed like the proposal PDF cache — every
  // call generates and stores a fresh copy rather than overwriting/reusing
  // one, since each report is itself a point-in-time snapshot worth keeping.
  const storagePath = `audit-reports/${proposalId}/${Date.now()}.pdf`
  const { error: uploadError } = await supabaseServer.storage
    .from(PDF_BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf' })
  if (uploadError) throw new Error(`Failed to upload audit report: ${uploadError.message}`)

  void logActivity({
    proposalId,
    action: 'audit_report_generated',
    actor: requestedByEmail,
    detail: filename,
  })

  const { data: signedUrlData, error: signError } = await supabaseServer.storage.from(PDF_BUCKET).createSignedUrl(storagePath, 60 * 60)
  if (signError || !signedUrlData) throw new Error(`Failed to sign audit report URL: ${signError?.message ?? 'unknown error'}`)

  return { filename, url: signedUrlData.signedUrl }
}
