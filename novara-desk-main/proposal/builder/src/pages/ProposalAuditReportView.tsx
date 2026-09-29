import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatUkDateTime } from '../lib/formatDateUk.js'

const PDF_STYLE_TAG_ID = 'audit-report-pdf-styles'

interface AuditAcceptance {
  signerName: string
  companyName: string
  email: string
  phone: string
  signatureMethod: 'drawn' | 'typed'
  signaturePath: string | null
  signatureUrl: string | null
  signatureText: string | null
  documentVersion: number
  acceptedAt: string
  ipAddress: string | null
  userAgent: string | null
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
  consentGiven: boolean
  consentText: string
}

interface AuditActivityEntry {
  action: string
  actor: string
  actorName: string | null
  detail: string | null
  createdAt: string
}

interface AuditView {
  id: string
  sessionId: string
  ipAddress: string | null
  userAgent: string | null
  geoCountry: string | null
  geoRegion: string | null
  geoCity: string | null
  viewedAt: string
  durationMs: number | null
}

interface AuditViewAnalytics {
  totalViews: number
  firstViewedAt: string | null
  lastViewedAt: string | null
  sessionCount: number
  averageDurationMs: number | null
  visitsBeforeSigning: number | null
}

interface AuditReportData {
  proposal: { id: string; proposalName: string; clientName: string; companyName: string; status: string; createdAt: string }
  documentVersion: number
  documentIntegrity: { currentHash: string; signedHash: string | null; modified: boolean | null }
  acceptance: AuditAcceptance | null
  activity: AuditActivityEntry[]
  viewAnalytics: AuditViewAnalytics
  recentViews: AuditView[]
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Proposal created',
  content_updated: 'Content updated',
  draft: 'Marked Draft',
  ready: 'Marked Ready',
  approved: 'Approved',
  rejected: 'Rejected',
  internal_review: 'Sent for internal review',
  changes_requested: 'Changes requested',
  ready_for_pdf: 'Marked Ready for PDF',
  email_sent: 'Sent to client',
  email_failed: 'Email failed to send',
  viewed: 'Viewed by client',
  accepted: 'Client signed',
  archived: 'Archived',
  pdf_generated: 'PDF generated',
  audit_report_generated: 'Audit report downloaded',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

// ─── Print CSS — a plain, light, professional compliance document. Deliberately
// distinct from the dark client-facing proposal template: this is an internal
// evidence record, not a sales document, and needs to print/scan cleanly. ───
const REPORT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .report { font-family: 'General Sans', Arial, sans-serif; color: #14181A; background: #FFFFFF; max-width: 900px; margin: 0 auto; padding: 48px; }
  .report h1 { font-size: 22px; margin: 0 0 4px; }
  .report .subtitle { color: #5B6668; font-size: 12px; margin: 0 0 28px; }
  .report h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #14181A; border-bottom: 1px solid #D8DEDF; padding-bottom: 6px; margin: 28px 0 12px; }
  .report table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .report table td { padding: 5px 0; vertical-align: top; }
  .report table td.label { color: #5B6668; width: 220px; white-space: nowrap; }
  .report .banner { font-size: 12px; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; }
  .report .banner.ok { background: #E7F6F1; color: #0F6E4F; border: 1px solid #B9E6D5; }
  .report .banner.bad { background: #FCEAEA; color: #A32424; border: 1px solid #F3C2C2; }
  .report .banner.neutral { background: #F2F3F3; color: #5B6668; border: 1px solid #E1E4E5; }
  .report .signature-box { border: 1px solid #D8DEDF; border-radius: 6px; padding: 16px; min-height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .report .signature-box img { max-height: 70px; }
  .report .signature-box .typed { font-family: 'Brush Script MT', cursive; font-size: 28px; }
  .report table.timeline { font-size: 11px; }
  .report table.timeline td { padding: 4px 0; border-bottom: 1px solid #EEF0F0; }
  .report .quote { font-size: 11px; font-style: italic; color: #5B6668; border-left: 2px solid #D8DEDF; padding-left: 10px; margin-top: 6px; }
  .report .footer { margin-top: 32px; font-size: 10px; color: #8B9496; }
`

export function ProposalAuditReportView() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AuditReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/pdf/resolve?id=${encodeURIComponent(id)}&type=audit`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || `Failed to load audit report (${res.status})`)
        return body
      })
      .then((body) => !cancelled && setData(body))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load audit report'))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!data && !error) return

    async function prepareForPrint() {
      try {
        await Promise.race([window.document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))])
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (e) {
        console.error('ProposalAuditReportView: prepareForPrint failed, proceeding anyway', e)
      }
      let styleTag = window.document.getElementById(PDF_STYLE_TAG_ID) as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = window.document.createElement('style')
        styleTag.id = PDF_STYLE_TAG_ID
        window.document.head.appendChild(styleTag)
      }
      styleTag.textContent = '@page { size: A4; margin: 0; }'
      window.document.body.setAttribute('data-pdf-ready', 'true')
    }

    void prepareForPrint()
  }, [data, error])

  if (error) return <div style={{ padding: 24, color: 'red', fontFamily: 'sans-serif' }}>{error}</div>
  if (!data) return null

  const { proposal, documentVersion, documentIntegrity, acceptance, activity, viewAnalytics, recentViews } = data

  return (
    <>
      <style>{REPORT_STYLES}</style>
      <div className="report">
        <h1>Proposal Audit Report</h1>
        <p className="subtitle">
          {proposal.proposalName} — Proposal ID {proposal.id} — Generated {formatUkDateTime(new Date().toISOString())}
        </p>

        <h2>Document Integrity</h2>
        {documentIntegrity.modified === null ? (
          <div className="banner neutral">
            {acceptance
              ? 'Integrity check unavailable — this signature was recorded before document-hash verification existed.'
              : 'Not yet signed — no signature to check content integrity against.'}
          </div>
        ) : documentIntegrity.modified ? (
          <div className="banner bad">
            Modified after signing on {acceptance ? formatUkDateTime(acceptance.acceptedAt) : ''} — this signature is no
            longer valid for the current version of this document.
          </div>
        ) : (
          <div className="banner ok">Content unchanged since signing — this signature is valid for the current document.</div>
        )}
        <table>
          <tbody>
            <tr>
              <td className="label">Document version</td>
              <td>v{documentVersion}</td>
            </tr>
            <tr>
              <td className="label">Current content hash (SHA-256)</td>
              <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{documentIntegrity.currentHash}</td>
            </tr>
            {documentIntegrity.signedHash && (
              <tr>
                <td className="label">Content hash at signing</td>
                <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{documentIntegrity.signedHash}</td>
              </tr>
            )}
          </tbody>
        </table>

        {acceptance ? (
          <>
            <h2>Signature</h2>
            <div className="signature-box">
              {acceptance.signatureMethod === 'drawn' && acceptance.signatureUrl ? (
                <img src={acceptance.signatureUrl} alt={`${acceptance.signerName}'s signature`} />
              ) : (
                <span className="typed">{acceptance.signatureText}</span>
              )}
            </div>

            <h2>Signer Information</h2>
            <table>
              <tbody>
                <tr>
                  <td className="label">Full name</td>
                  <td>{acceptance.signerName}</td>
                </tr>
                <tr>
                  <td className="label">Company</td>
                  <td>{acceptance.companyName}</td>
                </tr>
                <tr>
                  <td className="label">Email</td>
                  <td>{acceptance.email}</td>
                </tr>
                <tr>
                  <td className="label">Phone</td>
                  <td>{acceptance.phone || '—'}</td>
                </tr>
                <tr>
                  <td className="label">Proposal version signed</td>
                  <td>v{acceptance.documentVersion}</td>
                </tr>
                <tr>
                  <td className="label">Signed at (UK time)</td>
                  <td>{formatUkDateTime(acceptance.acceptedAt)}</td>
                </tr>
                <tr>
                  <td className="label">Signed at (UTC, stored)</td>
                  <td>{acceptance.acceptedAt}</td>
                </tr>
              </tbody>
            </table>

            <h2>Device &amp; Environment</h2>
            <table>
              <tbody>
                <tr>
                  <td className="label">IP address</td>
                  <td>{acceptance.ipAddress || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Location (from IP, approximate)</td>
                  <td>{[acceptance.geoCity, acceptance.geoRegion, acceptance.geoCountry].filter(Boolean).join(', ') || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Device type</td>
                  <td>{acceptance.deviceType || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Browser</td>
                  <td>{acceptance.browserName ? `${acceptance.browserName} ${acceptance.browserVersion ?? ''}`.trim() : 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Operating system</td>
                  <td>{acceptance.osName ? `${acceptance.osName} ${acceptance.osVersion ?? ''}`.trim() : 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Screen resolution</td>
                  <td>{acceptance.screenResolution || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Browser viewport</td>
                  <td>{acceptance.viewportSize || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Preferred language</td>
                  <td>{acceptance.preferredLanguage || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">Browser timezone</td>
                  <td>{acceptance.browserTimezone || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="label">User agent (raw)</td>
                  <td style={{ fontSize: 10, wordBreak: 'break-all' }}>{acceptance.userAgent || 'Not recorded'}</td>
                </tr>
              </tbody>
            </table>

            <h2>Security &amp; Verification</h2>
            <table>
              <tbody>
                <tr>
                  <td className="label">Signer identity verification</td>
                  <td>Not verified — access via the proposal link only (no OTP/email verification step exists in the current signing flow)</td>
                </tr>
                <tr>
                  <td className="label">Proposal link authentication</td>
                  <td>Authenticated via a unique, single-use share token</td>
                </tr>
                <tr>
                  <td className="label">Signature file integrity</td>
                  <td>Checked on upload (valid image, not corrupted)</td>
                </tr>
                <tr>
                  <td className="label">Consent</td>
                  <td>{acceptance.consentGiven ? 'Explicit checkbox agreement captured and stored' : 'Not recorded'}</td>
                </tr>
              </tbody>
            </table>
            <p className="quote">&ldquo;{acceptance.consentText}&rdquo;</p>
          </>
        ) : (
          <div className="banner neutral" style={{ marginTop: 20 }}>
            This proposal has not been signed yet — no signature, signer, or device information is available.
          </div>
        )}

        <h2>View &amp; Session History</h2>
        <table>
          <tbody>
            <tr>
              <td className="label">Total views</td>
              <td>{viewAnalytics.totalViews}</td>
            </tr>
            <tr>
              <td className="label">Number of sessions</td>
              <td>{viewAnalytics.sessionCount}</td>
            </tr>
            <tr>
              <td className="label">First viewed</td>
              <td>{viewAnalytics.firstViewedAt ? formatUkDateTime(viewAnalytics.firstViewedAt) : '—'}</td>
            </tr>
            <tr>
              <td className="label">Last viewed</td>
              <td>{viewAnalytics.lastViewedAt ? formatUkDateTime(viewAnalytics.lastViewedAt) : '—'}</td>
            </tr>
            <tr>
              <td className="label">Average time spent (approximate)</td>
              <td>{viewAnalytics.averageDurationMs !== null ? `~${formatDuration(viewAnalytics.averageDurationMs)}` : 'Not enough data'}</td>
            </tr>
            <tr>
              <td className="label">Visits before signing</td>
              <td>{viewAnalytics.visitsBeforeSigning !== null ? viewAnalytics.visitsBeforeSigning : 'Not yet signed'}</td>
            </tr>
          </tbody>
        </table>
        {recentViews.length > 0 && (
          <table className="timeline" style={{ marginTop: 10 }}>
            <tbody>
              {recentViews.map((v) => (
                <tr key={v.id}>
                  <td style={{ width: 150 }}>{formatUkDateTime(v.viewedAt)}</td>
                  <td>{v.ipAddress || 'IP not recorded'}</td>
                  <td>{[v.geoCity, v.geoCountry].filter(Boolean).join(', ') || '—'}</td>
                  <td>{v.durationMs ? `~${formatDuration(v.durationMs)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Activity Timeline</h2>
        <table className="timeline">
          <tbody>
            {activity.map((entry, i) => (
              <tr key={i}>
                <td style={{ width: 150 }}>{formatUkDateTime(entry.createdAt)}</td>
                <td style={{ width: 180 }}>{actionLabel(entry.action)}</td>
                <td>
                  {entry.actorName || entry.actor}
                  {entry.detail && <span style={{ color: '#8B9496' }}> — {entry.detail}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="footer">
          This report was generated by Novara Desk on {formatUkDateTime(new Date().toISOString())} for internal
          compliance and legal-evidence purposes. Proposal ID: {proposal.id}.
        </p>
      </div>
    </>
  )
}
