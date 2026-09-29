// Vercel Serverless Function — records a client's acceptance (signature,
// signer name, timestamp, exact document version) and flips the proposal
// to "signed". Then, best-effort: stamps a final signed PDF and notifies
// the internal team — neither of those can ever fail the client's own
// submission, which already succeeded the moment the acceptance row and
// status update above complete.

import { resolveShareToken, ShareLinkError } from '../_lib/share/resolveToken.js'
import { supabaseServer } from '../_lib/supabaseServerClient.js'
import { generateProposalPdf } from '../_lib/pdf/proposalPdfAdapter.js'
import { stampSignature } from '../_lib/pdf/stampSignature.js'
import { sendAcceptanceNotification } from '../_lib/notify/sendAcceptanceNotification.js'
import { logActivity } from '../_lib/activity/logActivity.js'
import { parseUserAgentStructured } from '../_lib/useragent/parseUserAgent.js'
import { computeDocumentHash } from '../_lib/audit/documentHash.js'
import { extractClientRequestContext } from '../_lib/request/clientContext.js'
import { getProviderName, type ProviderIdentity } from '../../src/modules/branding/identity.js'

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

interface AcceptBody {
  token?: string
  signerName?: string
  company?: string
  email?: string
  phone?: string
  method?: 'drawn' | 'typed'
  signatureDataUrl?: string
  signatureText?: string
  consent?: boolean
  // Best-effort browser-reported context (src/lib/deviceContext.ts) — all
  // optional, never validated as "required," only sanity-capped in length
  // and shape below, same as every other field the client sends.
  screenResolution?: string
  viewportSize?: string
  preferredLanguage?: string
  browserTimezone?: string
}

// The exact wording shown next to the checkbox in AcceptanceForm.tsx —
// duplicated here (not imported) since this is a server function and that's
// a client component; kept as the one literal each side must match, same
// pattern already used for the email/phone regexes above. Stored verbatim
// on the acceptance row as consent_text, so a later change to this wording
// can never retroactively alter what a past signer is shown to have agreed to.
function buildConsentText(identity: ProviderIdentity): string {
  return `I have read and agree to the ${getProviderName(identity)} Service Agreement and confirm my authority to accept this proposal on behalf of the named company.`
}

const SIGNATURE_BUCKET = 'proposal-signatures'
const PDF_BUCKET = 'proposal-pdfs'
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// Generous for a signature drawing (canvas is a fixed small resolution) — well
// above what a legitimate signature produces, just a backstop against abuse.
const MAX_SIGNATURE_BASE64_LENGTH = 2_000_000
const MAX_SIGNER_NAME_LENGTH = 200
const MAX_FIELD_LENGTH = 200
// Same rules as AcceptanceForm.tsx's client-side check — re-validated here since the client
// value is never trusted.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_DIGITS_PATTERN = /^\+?\d{7,15}$/
// Postgres unique_violation — the DB-level backstop for the duplicate-submission check below.
const UNIQUE_VIOLATION = '23505'
// e.g. "1920x1080" — matches window.screen.width/height and innerWidth/innerHeight's format from deviceContext.ts.
const RESOLUTION_PATTERN = /^\d{1,5}x\d{1,5}$/
const MAX_CONTEXT_FIELD_LENGTH = 100

/**
 * Best-effort device-context fields are optional and never block
 * submission — an invalid/oversized/spoofed value is simply dropped
 * (null), never rejected as a 400. This mirrors how every other piece of
 * audit-trail metadata in this file behaves: capture what's genuinely
 * usable, never let a client-supplied value gate whether signing succeeds.
 */
function sanitizeOptionalField(value: string | undefined, pattern?: RegExp): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_CONTEXT_FIELD_LENGTH) return null
  if (pattern && !pattern.test(trimmed)) return null
  return trimmed
}

function isValidPng(buffer: Buffer): boolean {
  return buffer.length > PNG_MAGIC_BYTES.length && buffer.subarray(0, PNG_MAGIC_BYTES.length).equals(PNG_MAGIC_BYTES)
}

/**
 * Every code path below returns through `res.status(...).json(...)` — never
 * HTML, never a bare throw. The outer `handler` wraps this in a catch-all
 * (matching api/proposals/send.ts's pattern) so even a totally unexpected
 * failure in this critical path (signature upload, acceptance insert,
 * status update) still comes back as JSON to the client rather than a
 * platform-generated HTML/crash page — this is a public, unauthenticated,
 * customer-facing signature-submission endpoint.
 */
async function handleAccept(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = (req.body as AcceptBody) || {}
  if (!body.token || !body.signerName?.trim() || !body.email?.trim() || !body.phone?.trim() || !body.method) {
    return res.status(400).json({ error: 'Missing required fields: token, signerName, email, phone, method' })
  }
  if (body.signerName.trim().length > MAX_SIGNER_NAME_LENGTH) {
    return res.status(400).json({ error: 'Signer name is too long' })
  }
  if (!EMAIL_PATTERN.test(body.email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (!PHONE_DIGITS_PATTERN.test(body.phone.trim().replace(/[\s()-]/g, ''))) {
    return res.status(400).json({ error: 'Enter a valid international phone number' })
  }
  if ((body.company?.length ?? 0) > MAX_FIELD_LENGTH || body.email.trim().length > MAX_FIELD_LENGTH || body.phone.trim().length > MAX_FIELD_LENGTH) {
    return res.status(400).json({ error: 'One or more fields are too long' })
  }
  if (body.method === 'drawn' && !body.signatureDataUrl) {
    return res.status(400).json({ error: 'Missing signature drawing' })
  }
  if (body.method === 'drawn' && body.signatureDataUrl) {
    if (!body.signatureDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
      return res.status(400).json({ error: 'Signature must be a PNG image' })
    }
    if (body.signatureDataUrl.length > MAX_SIGNATURE_BASE64_LENGTH) {
      return res.status(400).json({ error: 'Signature image is too large' })
    }
  }
  if (body.method === 'typed' && !body.signatureText?.trim()) {
    return res.status(400).json({ error: 'Missing typed signature' })
  }
  if (body.method === 'typed' && body.signatureText && body.signatureText.trim().length > MAX_SIGNER_NAME_LENGTH) {
    return res.status(400).json({ error: 'Typed signature is too long' })
  }
  if (body.consent !== true) {
    return res.status(400).json({ error: 'You must agree to the Service Agreement before accepting this proposal' })
  }

  let proposalId: string
  try {
    ;({ proposalId } = await resolveShareToken(body.token))
  } catch (e) {
    if (e instanceof ShareLinkError) return res.status(e.status).json({ error: e.message })
    throw e
  }

  const { data: existing } = await supabaseServer
    .from('proposal_builder_acceptances')
    .select('id')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (existing) return res.status(409).json({ error: 'This proposal has already been accepted' })

  const { data: documentRow, error: documentError } = await supabaseServer
    .from('proposal_builder_documents')
    .select('id, document_version, pages, variables, content_overrides')
    .eq('proposal_id', proposalId)
    .single()
  if (documentError || !documentRow) return res.status(404).json({ error: 'Proposal document not found' })

  // Snapshot of exactly what was agreed to, hashed for later tamper/edit
  // detection — see api/_lib/audit/documentHash.ts's doc comment. Field
  // names here (contentOverrides, not content_overrides) must match the
  // browser-side re-hash in DocumentIntegrityBanner.tsx exactly.
  const documentHash = computeDocumentHash({
    pages: documentRow.pages,
    variables: documentRow.variables,
    contentOverrides: documentRow.content_overrides,
  })

  let signaturePath: string | null = null
  if (body.method === 'drawn' && body.signatureDataUrl) {
    const base64 = body.signatureDataUrl.slice(PNG_DATA_URL_PREFIX.length)
    const buffer = Buffer.from(base64, 'base64')
    if (!isValidPng(buffer)) return res.status(400).json({ error: 'Signature data is not a valid PNG image' })

    signaturePath = `${proposalId}/${Date.now()}.png`

    const { error: uploadError } = await supabaseServer.storage
      .from(SIGNATURE_BUCKET)
      .upload(signaturePath, buffer, { contentType: 'image/png' })
    if (uploadError) {
      console.error('client/accept.ts: signature upload failed:', uploadError.message)
      return res.status(500).json({ error: 'Failed to store your signature. Please try again.' })
    }
  }

  const { ipAddress, userAgent, geoCountry, geoRegion, geoCity, geoTimezone } = extractClientRequestContext(req)
  // Parsed once, here, at accept time — never re-derived at display time
  // the way the legacy parseUserAgent() display helper works. The raw
  // user_agent string above is still stored regardless, as the ground truth.
  const parsedUa = userAgent ? parseUserAgentStructured(userAgent) : null

  const signerName = body.signerName.trim()

  // Fetched before the insert (rather than after, as the PDF/notification
  // best-effort section alone would need) so proposal_name/client_name can be
  // denormalized onto the acceptance row itself — an audit-trail snapshot,
  // consistent with document_version above.
  const { data: proposalRow } = await supabaseServer
    .from('proposal_builder_proposals')
    .select('proposal_name, client_name, company_name, provider_identity')
    .eq('id', proposalId)
    .single()
  const consentText = buildConsentText(proposalRow?.provider_identity ?? 'novara')

  // ── Critical path: this insert + status update are the client's actual
  // submission. Everything after this point is best-effort follow-on. ──
  const { data: acceptanceRow, error: insertError } = await supabaseServer
    .from('proposal_builder_acceptances')
    .insert({
      proposal_id: proposalId,
      document_id: documentRow.id,
      document_version: documentRow.document_version,
      signer_name: signerName,
      signature_method: body.method,
      signature_path: signaturePath,
      signature_text: body.method === 'typed' ? body.signatureText!.trim() : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      browser_name: parsedUa?.browserName ?? null,
      browser_version: parsedUa?.browserVersion ?? null,
      os_name: parsedUa?.osName ?? null,
      os_version: parsedUa?.osVersion ?? null,
      device_type: parsedUa?.deviceType ?? null,
      screen_resolution: sanitizeOptionalField(body.screenResolution, RESOLUTION_PATTERN),
      viewport_size: sanitizeOptionalField(body.viewportSize, RESOLUTION_PATTERN),
      preferred_language: sanitizeOptionalField(body.preferredLanguage),
      browser_timezone: sanitizeOptionalField(body.browserTimezone),
      geo_country: geoCountry,
      geo_region: geoRegion,
      geo_city: geoCity,
      geo_timezone: geoTimezone,
      document_hash: documentHash,
      proposal_name: proposalRow?.proposal_name ?? '',
      client_name: proposalRow?.client_name ?? '',
      company_name: body.company?.trim() || proposalRow?.company_name || '',
      email: body.email.trim(),
      phone: body.phone.trim(),
      consent_given: true,
      consent_text: consentText,
    })
    .select('id, accepted_at')
    .single()
  if (insertError?.code === UNIQUE_VIOLATION) {
    return res.status(409).json({ error: 'This proposal has already been accepted' })
  }
  if (insertError || !acceptanceRow) {
    console.error('client/accept.ts: acceptance insert failed:', insertError?.message ?? 'unknown error')
    return res.status(500).json({ error: 'Failed to record your acceptance. Please try again.' })
  }

  await supabaseServer
    .from('proposal_builder_proposals')
    .update({ status: 'signed', updated_at: new Date().toISOString() })
    .eq('id', proposalId)

  void logActivity({
    proposalId,
    action: 'accepted',
    actor: 'client',
    actorName: signerName,
    detail: `Signed via ${body.method === 'drawn' ? 'drawn signature' : 'typed signature'}`,
  })

  // ── Best-effort from here: signed-PDF stamping + team notification.
  // Neither can fail the response the client already earned above. ──
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    if (baseUrl) {
      const draft = await generateProposalPdf(proposalId, baseUrl)
      const draftPdfRes = await fetch(draft.url)
      const draftPdfBytes = Buffer.from(await draftPdfRes.arrayBuffer())

      let signatureImageBytes: Buffer | undefined
      if (body.method === 'drawn' && signaturePath) {
        const { data: sigBlob } = await supabaseServer.storage.from(SIGNATURE_BUCKET).download(signaturePath)
        if (sigBlob) signatureImageBytes = Buffer.from(await sigBlob.arrayBuffer())
      }

      const signedBytes = await stampSignature({
        pdfBytes: draftPdfBytes,
        signerName,
        acceptedAt: acceptanceRow.accepted_at,
        method: body.method,
        signatureImageBytes,
        signatureText: body.method === 'typed' ? body.signatureText : undefined,
      })

      const signedStoragePath = `signed/${proposalId}/${documentRow.document_version}.pdf`
      const signedFilename = draft.filename.replace(/\.pdf$/i, '_Signed.pdf')

      await supabaseServer.storage
        .from(PDF_BUCKET)
        .upload(signedStoragePath, signedBytes, { contentType: 'application/pdf', upsert: true })

      await supabaseServer.from('proposal_builder_signed_pdfs').insert({
        proposal_id: proposalId,
        document_id: documentRow.id,
        document_version: documentRow.document_version,
        acceptance_id: acceptanceRow.id,
        storage_path: signedStoragePath,
        filename: signedFilename,
      })
    }
  } catch (e) {
    console.error('accept.ts signed-PDF stamping error:', e instanceof Error ? e.message : e)
  }

  if (proposalRow) {
    // notifyTeam() (team_members-resolved Operations/Developer/Jayson) is
    // deliberately not called here — it duplicated this email for anyone it
    // shares a recipient with. sendAcceptanceNotification's fixed recipient
    // list below is the single source of truth for the acceptance email.
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      await sendAcceptanceNotification({
        proposalName: proposalRow.proposal_name,
        clientName: proposalRow.client_name,
        companyName: body.company?.trim() || proposalRow.company_name,
        signerName,
        email: body.email.trim(),
        phone: body.phone.trim(),
        acceptedAt: acceptanceRow.accepted_at,
        proposalLink: baseUrl ? `${baseUrl}/p/${body.token}` : `/p/${body.token}`,
      })
    } catch (e) {
      console.error('accept.ts sendAcceptanceNotification error:', e instanceof Error ? e.message : e)
    }
  }

  return res.status(200).json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleAccept(req, res)
  } catch (e) {
    console.error('client/accept.ts: unexpected error:', e instanceof Error ? e.stack ?? e.message : e)
    return res.status(500).json({ error: 'Something went wrong submitting your acceptance. Please try again.' })
  }
}
