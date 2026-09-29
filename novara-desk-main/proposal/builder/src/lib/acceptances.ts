import { supabase } from './supabaseClient.js'

const TABLE = 'proposal_builder_acceptances'
const SIGNATURE_BUCKET = 'proposal-signatures'

/** Raw shape of a row in `proposal_builder_acceptances` (snake_case). */
interface AcceptanceRow {
  id: string
  document_version: number
  signer_name: string
  company_name: string
  email: string
  phone: string
  signature_method: 'drawn' | 'typed'
  signature_path: string | null
  signature_text: string | null
  accepted_at: string
  ip_address: string | null
  user_agent: string | null
  consent_given: boolean
  consent_text: string
  // Structured UA fields — null for acceptances recorded before this
  // parsing existed (see add_proposal_acceptance_ua_structured.sql); the
  // UI falls back to parseUserAgent(user_agent) for exactly those rows.
  browser_name: string | null
  browser_version: string | null
  os_name: string | null
  os_version: string | null
  device_type: string | null
  screen_resolution: string | null
  viewport_size: string | null
  preferred_language: string | null
  browser_timezone: string | null
  geo_country: string | null
  geo_region: string | null
  geo_city: string | null
  geo_timezone: string | null
  document_hash: string | null
}

export interface Acceptance {
  id: string
  documentVersion: number
  signerName: string
  companyName: string
  email: string
  phone: string
  signatureMethod: 'drawn' | 'typed'
  signaturePath: string | null
  signatureText: string | null
  acceptedAt: string
  ipAddress: string | null
  userAgent: string | null
  consentGiven: boolean
  consentText: string
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: string | null
  screenResolution: string | null
  viewportSize: string | null
  preferredLanguage: string | null
  browserTimezone: string | null
  geoCountry: string | null
  geoRegion: string | null
  geoCity: string | null
  geoTimezone: string | null
  documentHash: string | null
}

function toAcceptance(row: AcceptanceRow): Acceptance {
  return {
    id: row.id,
    documentVersion: row.document_version,
    signerName: row.signer_name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    signatureMethod: row.signature_method,
    signaturePath: row.signature_path,
    signatureText: row.signature_text,
    acceptedAt: row.accepted_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    consentGiven: row.consent_given,
    consentText: row.consent_text,
    browserName: row.browser_name,
    browserVersion: row.browser_version,
    osName: row.os_name,
    osVersion: row.os_version,
    deviceType: row.device_type,
    screenResolution: row.screen_resolution,
    viewportSize: row.viewport_size,
    preferredLanguage: row.preferred_language,
    browserTimezone: row.browser_timezone,
    geoCountry: row.geo_country,
    geoRegion: row.geo_region,
    geoCity: row.geo_city,
    geoTimezone: row.geo_timezone,
    documentHash: row.document_hash,
  }
}

/** "Bristol, England, United Kingdom" style combined location string — omits any part that's missing rather than showing empty commas. */
export function formatGeoLocation(acceptance: Acceptance): string {
  const parts = [acceptance.geoCity, acceptance.geoRegion, acceptance.geoCountry].filter((p): p is string => Boolean(p))
  return parts.length > 0 ? parts.join(', ') : 'Not recorded'
}

/** "Chrome 128 on Windows 10/11 (desktop)" — the structured display string used once the row has been through the accept-time parser. */
export function formatDeviceInfo(acceptance: Acceptance): string {
  const { browserName, browserVersion, osName, osVersion, deviceType } = acceptance
  if (!browserName && !osName) return acceptance.userAgent ? parseUserAgent(acceptance.userAgent) : 'Not recorded'
  const browser = browserName ? `${browserName}${browserVersion ? ` ${browserVersion}` : ''}` : 'Unknown browser'
  const os = osName ? `${osName}${osVersion ? ` ${osVersion}` : ''}` : 'Unknown OS'
  const device = deviceType && deviceType !== 'unknown' ? ` (${deviceType})` : ''
  return `${browser} on ${os}${device}`
}

/**
 * Fetches the acceptance record for a proposal, if it has been signed — the
 * full Signature Evidence / Audit Trail shown on ProposalDetail.tsx. Goes
 * through the anon-key `supabase` client (staff-only RLS), same as every
 * other admin-side read in this app.
 */
export async function getAcceptanceForProposal(proposalId: string): Promise<Acceptance | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, document_version, signer_name, company_name, email, phone, signature_method, signature_path, signature_text, accepted_at, ip_address, user_agent, consent_given, consent_text, browser_name, browser_version, os_name, os_version, device_type, screen_resolution, viewport_size, preferred_language, browser_timezone, geo_country, geo_region, geo_city, geo_timezone, document_hash'
    )
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toAcceptance(data as AcceptanceRow) : null
}

/**
 * A drawn signature lives in the private `proposal-signatures` bucket, so
 * displaying it needs a signed URL rather than a direct/public one — same
 * mechanism already used for signed PDFs (see index.html's
 * `oiOpenSignedPdf`, `storage.from('proposal-pdfs').createSignedUrl`); this
 * bucket's storage RLS mirrors that one exactly. 1 hour is enough for a
 * single page view; the URL isn't persisted anywhere.
 */
export async function getSignatureImageUrl(signaturePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(SIGNATURE_BUCKET).createSignedUrl(signaturePath, 60 * 60)
  if (error || !data) throw new Error(error?.message ?? 'Could not load signature image')
  return data.signedUrl
}

/**
 * Lightweight, dependency-free User-Agent parse — enough to show "Chrome on
 * macOS" in an audit trail, not a full UA-parsing library. Falls back to
 * the raw string for anything it doesn't recognise rather than guessing.
 */
export function parseUserAgent(userAgent: string): string {
  const ua = userAgent

  let browser = 'Unknown browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) browser = 'Chrome'
  else if (/CriOS\//.test(ua)) browser = 'Chrome'
  else if (/FxiOS\//.test(ua)) browser = 'Firefox'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari'

  let os = 'Unknown device'
  if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/iPad/.test(ua)) os = 'iPad'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Linux/.test(ua)) os = 'Linux'

  if (browser === 'Unknown browser' && os === 'Unknown device') return ua
  return `${browser} on ${os}`
}
