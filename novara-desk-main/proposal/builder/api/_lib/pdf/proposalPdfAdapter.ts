// The ONLY place in the PDF engine that knows "proposal" exists. Everything
// document-specific (status gating, filename, cache lookup) lives here;
// api/_lib/pdf/engine.ts stays completely document-agnostic. A future
// Quotation/Invoice/Contract adapter would be a sibling file of near-
// identical shape — it would never touch engine.ts.

import { supabaseServer } from '../supabaseServerClient.js'
import { renderUrlToPdf } from './engine.js'
import { logActivity } from '../activity/logActivity.js'
import { buildFilename, DEFAULT_FILENAME_TEMPLATE, getPdfCacheKey } from '../../../src/modules/pdf/index.js'
import { PDF_VIEWABLE_STATUSES } from '../../../src/modules/status/gates.js'

const PDF_BUCKET = 'proposal-pdfs'

export interface ProposalPdfResult {
  filename: string
  pageCount: number
  documentVersion: number
  cached: boolean
  storagePath: string
  url: string
}

export async function generateProposalPdf(proposalId: string, baseUrl: string): Promise<ProposalPdfResult> {
  const { data: proposalRow, error: proposalError } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('id, client_name, company_name, proposal_name, status')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposalRow) throw new Error('Proposal not found')
  if (!PDF_VIEWABLE_STATUSES.includes(proposalRow.status)) {
    throw new Error(`Proposal must be Approved before generating a PDF (current status: ${proposalRow.status})`)
  }

  const { data: documentRow, error: documentError } = await supabaseServer
    .from('proposal_builder_documents')
    .select('id, document_version')
    .eq('proposal_id', proposalId)
    .single()

  if (documentError || !documentRow) throw new Error('Proposal document not found')

  const filename = buildFilename(DEFAULT_FILENAME_TEMPLATE, {
    clientName: proposalRow.client_name,
    companyName: proposalRow.company_name,
    proposalName: proposalRow.proposal_name,
    year: new Date().getFullYear(),
  })

  const storagePath = `${getPdfCacheKey(documentRow.id, documentRow.document_version)}.pdf`

  const { data: cachedRow } = await supabaseServer
    .from('proposal_builder_pdfs')
    .select('storage_path, filename')
    .eq('document_id', documentRow.id)
    .eq('document_version', documentRow.document_version)
    .maybeSingle()

  if (cachedRow) {
    const url = await getSignedUrl(cachedRow.storage_path)
    return {
      filename: cachedRow.filename,
      pageCount: 0,
      documentVersion: documentRow.document_version,
      cached: true,
      storagePath: cachedRow.storage_path,
      url,
    }
  }

  const printUrl = `${baseUrl}/proposals/${proposalId}/pdf-view`
  const internalSecret = process.env.PDF_INTERNAL_SECRET
  const startedAt = Date.now()
  const { buffer, pageCount } = await renderUrlToPdf({
    url: printUrl,
    extraHeaders: internalSecret ? { 'x-pdf-internal-secret': internalSecret } : undefined,
  })
  const durationMs = Date.now() - startedAt

  const { error: uploadError } = await supabaseServer.storage
    .from(PDF_BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`Failed to upload PDF: ${uploadError.message}`)

  await supabaseServer.from('proposal_builder_pdfs').insert({
    document_id: documentRow.id,
    document_version: documentRow.document_version,
    storage_path: storagePath,
    filename,
  })

  // "Generated in <n>ms" is a deliberately simple, human-readable convention
  // (not JSON) — the activity timeline already renders `detail` as plain
  // text, and Ops Intel's Analytics view (Phase 10) parses this same
  // pattern back out with a small regex for "Average PDF Generation Time".
  void logActivity({ proposalId, action: 'pdf_generated', actor: 'system', detail: `${filename} — generated in ${durationMs}ms` })

  const url = await getSignedUrl(storagePath)

  return {
    filename,
    pageCount,
    documentVersion: documentRow.document_version,
    cached: false,
    storagePath,
    url,
  }
}

async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseServer.storage.from(PDF_BUCKET).createSignedUrl(storagePath, 60 * 60)
  if (error || !data) throw new Error(`Failed to sign PDF URL: ${error?.message ?? 'unknown error'}`)
  return data.signedUrl
}
