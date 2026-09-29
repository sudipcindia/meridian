import { useEffect, useState } from 'react'
import { Send, Copy, Check, ExternalLink } from 'lucide-react'
import { ErrorBanner } from '../ErrorBanner.js'
import { inputClass } from '../FormField.js'
import { apiFetch } from '../../lib/apiFetch.js'
import { getShareLink } from '../../lib/shareLink.js'
import { SENDABLE_STATUSES, CLIENT_VIEWABLE_STATUSES } from '../../modules/status/gates.js'
import type { Proposal } from '../../types/proposal.js'

interface SendToClientPanelProps {
  proposal: Proposal
  onSent: (proposal: Proposal) => void
}

/**
 * The default sharing workflow for a proposal: a stable, read-only public
 * link (Copy/Open — no login, works even if email is down or the user
 * would rather send it via WhatsApp/Slack/Teams/SMS), plus the existing
 * "Send Proposal" email action. The link becomes available the moment the
 * proposal is Approved — the same server-side gate api/proposals/send.ts
 * and api/pdf/generate.ts already use (see modules/status/gates.ts) — and
 * stays available through Sent/Signed, independent of whether an email
 * was ever successfully delivered.
 */
export function SendToClientPanel({ proposal, onSent }: SendToClientPanelProps) {
  const [clientEmail, setClientEmail] = useState(proposal.clientEmail || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentOk, setSentOk] = useState(false)

  const [shareLink, setShareLink] = useState<string | null>(null)
  const [shareLinkError, setShareLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const linkEligible = CLIENT_VIEWABLE_STATUSES.includes(proposal.status)
  const emailAllowed = SENDABLE_STATUSES.includes(proposal.status)
  const alreadySent = proposal.status === 'sent' || proposal.status === 'signed'

  useEffect(() => {
    if (!linkEligible) return
    let cancelled = false
    setShareLinkError(null)
    getShareLink(proposal.id)
      .then((link) => !cancelled && setShareLink(link))
      .catch((err) => !cancelled && setShareLinkError(err instanceof Error ? err.message : 'Failed to load share link'))
    return () => {
      cancelled = true
    }
  }, [proposal.id, linkEligible])

  async function handleCopy() {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleOpen() {
    if (!shareLink) return
    window.open(shareLink, '_blank', 'noopener,noreferrer')
  }

  async function handleSend() {
    setLoading(true)
    setError(null)
    setSentOk(false)
    try {
      const res = await apiFetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, clientEmail: clientEmail.trim() }),
        authenticated: true,
      })
      // The API always returns JSON, but a platform-level failure (a timeout,
      // a crash before the function even runs) could still hand back an HTML
      // error page instead — parse defensively so that shows a friendly
      // message rather than a raw "Unexpected token <" SyntaxError.
      let data: { error?: string; link?: string }
      try {
        data = await res.json()
      } catch {
        throw new Error('Something went wrong sending the proposal. Please try again.')
      }
      if (!res.ok) throw new Error(data.error || 'Something went wrong sending the proposal. Please try again.')
      setSentOk(true)
      setShareLink(data.link ?? shareLink)
      onSent({ ...proposal, clientEmail: clientEmail.trim(), status: 'sent' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send proposal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-5">
      <p className="font-clash-display text-white text-[16px]">Send to Client</p>

      {!linkEligible && (
        <p className="text-[12px] font-general-sans text-novara-light/40">
          This proposal must be Approved before it can be shared with the client.
        </p>
      )}

      {linkEligible && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
            Client Link
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareLink ?? (shareLinkError ? '' : 'Generating link…')}
              className={`${inputClass} flex-1 cursor-text`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => void handleCopy()}
              disabled={!shareLink}
              className="flex items-center gap-1.5 text-sm font-general-sans font-medium bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white px-3 py-2.5 rounded-lg border border-novara-border transition-colors shrink-0"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <button
              onClick={handleOpen}
              disabled={!shareLink}
              className="flex items-center gap-1.5 text-sm font-general-sans font-medium bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white px-3 py-2.5 rounded-lg border border-novara-border transition-colors shrink-0"
            >
              <ExternalLink size={15} />
              Open Link
            </button>
          </div>
          {shareLinkError ? (
            <ErrorBanner message={shareLinkError} />
          ) : (
            <p className="text-[11px] font-general-sans text-novara-light/40">
              Read-only — the client never needs to log in. Share it directly (WhatsApp, Slack, Teams, SMS, or however you
              like), or use Send Proposal below.
            </p>
          )}
        </div>
      )}

      {alreadySent && (
        <p className="text-[12px] font-general-sans text-novara-teal">
          Already sent to the client{proposal.status === 'signed' ? ' — accepted' : ''}.
        </p>
      )}

      <div className="flex flex-col gap-1.5 max-w-[320px]">
        <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
          Client Email
        </label>
        <input
          className={inputClass}
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="client@company.com"
          type="email"
        />
      </div>

      {error && <ErrorBanner heading="Couldn't send the proposal" message={error} />}
      {sentOk && <p className="text-[12px] font-general-sans text-novara-teal">Email sent.</p>}

      <button
        onClick={() => void handleSend()}
        disabled={!emailAllowed || loading || !clientEmail.trim()}
        className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        <Send size={15} />
        {loading ? 'Sending…' : 'Send Proposal'}
      </button>
    </div>
  )
}
