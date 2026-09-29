import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Archive, ArrowLeft, Trash2, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { FormField, inputClass } from '../components/FormField.js'
import { SimpleStatusBadge } from '../components/SimpleStatusBadge.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { ProposalTabs } from '../components/ProposalTabs.js'
import {
  archiveProposal,
  deleteProposal,
  duplicateProposal,
  getProposal,
  updateProposal,
  type ProposalUpdateInput,
} from '../lib/proposals.js'
import { getAcceptanceForProposal, getSignatureImageUrl, formatDeviceInfo, formatGeoLocation, type Acceptance } from '../lib/acceptances.js'
import { formatUkDateTime } from '../lib/formatDateUk.js'
import { DocumentIntegrityBanner } from '../components/proposal/DocumentIntegrityBanner.js'
import { ViewAnalyticsCard } from '../components/proposal/ViewAnalyticsCard.js'
import { DownloadAuditReportButton } from '../components/audit/DownloadAuditReportButton.js'
import { LIFECYCLE_STATUSES, PROPOSAL_TYPE_OPTIONS, STATUS_LABELS, type Proposal } from '../types/proposal.js'

export function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [form, setForm] = useState<ProposalUpdateInput>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null)
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null)
  const [signatureImageError, setSignatureImageError] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getProposal(id)
      .then((p) => {
        if (cancelled) return
        setProposal(p)
        if (p) {
          setForm({
            clientName: p.clientName,
            clientFirstName: p.clientFirstName,
            companyName: p.companyName,
            proposalName: p.proposalName,
            proposalType: p.proposalType,
            status: p.status,
            preparedBy: p.preparedBy,
            notes: p.notes,
          })
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || proposal?.status !== 'signed') return
    let cancelled = false
    getAcceptanceForProposal(id)
      .then((a) => !cancelled && setAcceptance(a))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, proposal?.status])

  useEffect(() => {
    if (!acceptance?.signaturePath) return
    let cancelled = false
    getSignatureImageUrl(acceptance.signaturePath)
      .then((url) => !cancelled && setSignatureImageUrl(url))
      .catch(() => !cancelled && setSignatureImageError(true))
    return () => {
      cancelled = true
    }
  }, [acceptance?.signaturePath])

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProposal(id, form)
      setProposal(updated)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save proposal')
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate() {
    if (!id) return
    try {
      const copy = await duplicateProposal(id)
      navigate(`/proposals/${copy.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate proposal')
    }
  }

  async function handleConfirmArchive() {
    if (!id) return
    try {
      await archiveProposal(id)
      setConfirmArchive(false)
      navigate('/')
    } catch (err) {
      setConfirmArchive(false)
      setError(err instanceof Error ? err.message : 'Failed to archive proposal')
    }
  }

  async function handleConfirmDelete() {
    if (!id) return
    setDeleting(true)
    try {
      await deleteProposal(id)
      navigate('/')
    } catch (err) {
      setConfirmDelete(false)
      setDeleting(false)
      setError(err instanceof Error ? err.message : 'Failed to delete proposal')
    }
  }

  if (loading) {
    return (
      <>
        <Topbar title="Loading…" />
        <div className="px-8 py-6" />
      </>
    )
  }

  if (error && !proposal) {
    return (
      <>
        <Topbar title="Proposal" />
        <div className="px-8 py-6">
          <ErrorBanner message={error} />
        </div>
      </>
    )
  }

  if (!proposal) {
    return (
      <>
        <Topbar title="Not Found" />
        <div className="px-8 py-6">
          <p className="text-sm font-general-sans text-novara-light/60">
            No proposal found with that ID.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle={`Prepared by ${proposal.preparedBy}`} />
      <div className="px-8"><ProposalTabs proposalId={proposal.id} /></div>

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[720px]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[13px] font-general-sans text-novara-light/50 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {error && <ErrorBanner message={error} />}

        {proposal.duplicatedFrom && (
          <p className="text-[12px] font-general-sans text-novara-light/40">
            Duplicated from another proposal (source ID: {proposal.duplicatedFrom})
          </p>
        )}

        <SimpleStatusBadge status={proposal.status} />

        {proposal.status === 'signed' && acceptance && (
          <div className="border border-novara-teal/25 rounded-xl p-6 bg-novara-teal/5 flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-clash-display text-white text-[16px]">Signature Evidence &amp; Audit Trail</p>
              {acceptance.consentGiven && (
                <span className="flex items-center gap-1.5 text-[12px] font-general-sans font-medium text-novara-teal">
                  <CheckCircle2 size={14} /> Terms &amp; Conditions Accepted
                </span>
              )}
            </div>

            {id && <DocumentIntegrityBanner proposalId={id} acceptance={acceptance} />}

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
                Signature
              </p>
              <div className="rounded-lg bg-white min-h-[110px] flex items-center justify-center p-4">
                {acceptance.signatureMethod === 'drawn' ? (
                  signatureImageUrl ? (
                    <img src={signatureImageUrl} alt={`${acceptance.signerName}'s signature`} className="max-h-[90px]" />
                  ) : signatureImageError ? (
                    <span className="text-[12px] font-general-sans text-red-500">Could not load signature image.</span>
                  ) : (
                    <span className="text-[12px] font-general-sans text-novara-dark/40">Loading signature…</span>
                  )
                ) : (
                  <span className="text-novara-dark text-[30px]" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                    {acceptance.signatureText}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-general-sans text-novara-light/40">
                Captured via {acceptance.signatureMethod === 'drawn' ? 'hand-drawn signature' : 'typed signature'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] font-general-sans text-white/90">
              <span className="text-novara-light/50">Signed by</span>
              <span>{acceptance.signerName}</span>
              <span className="text-novara-light/50">Company</span>
              <span>{acceptance.companyName}</span>
              <span className="text-novara-light/50">Email</span>
              <span>{acceptance.email}</span>
              <span className="text-novara-light/50">Phone</span>
              <span>{acceptance.phone || '—'}</span>
              <span className="text-novara-light/50">Document Version</span>
              <span>v{acceptance.documentVersion}</span>
              <span className="text-novara-light/50">Accepted</span>
              <span>{formatUkDateTime(acceptance.acceptedAt)}</span>
              <span className="text-novara-light/50">IP Address</span>
              <span>{acceptance.ipAddress || 'Not recorded'}</span>
              <span className="text-novara-light/50">Location (from IP, approximate)</span>
              <span>{formatGeoLocation(acceptance)}</span>
              <span className="text-novara-light/50">Browser / Device</span>
              <span>{formatDeviceInfo(acceptance)}</span>
              <span className="text-novara-light/50">Screen Resolution</span>
              <span>{acceptance.screenResolution || 'Not recorded'}</span>
              <span className="text-novara-light/50">Browser Viewport</span>
              <span>{acceptance.viewportSize || 'Not recorded'}</span>
              <span className="text-novara-light/50">Preferred Language</span>
              <span>{acceptance.preferredLanguage || 'Not recorded'}</span>
              <span className="text-novara-light/50">Browser Timezone</span>
              <span>{acceptance.browserTimezone || 'Not recorded'}</span>
            </div>

            <div className="border-t border-novara-teal/15 pt-3">
              <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide mb-1">
                Agreement Accepted
              </p>
              <p className="text-[12px] font-general-sans text-novara-light/60 italic">&ldquo;{acceptance.consentText}&rdquo;</p>
            </div>

            <div className="border-t border-novara-teal/15 pt-3 flex flex-col gap-2">
              <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
                Security &amp; Verification
              </p>
              <div className="flex flex-col gap-1.5 text-[12px] font-general-sans">
                <span className="flex items-center gap-1.5 text-novara-light/70">
                  <ShieldAlert size={13} className="text-novara-light/40 shrink-0" />
                  Signer identity: not independently verified — this signer had access via the proposal link only (no email or OTP verification step exists in the current signing flow)
                </span>
                <span className="flex items-center gap-1.5 text-novara-light/70">
                  <ShieldCheck size={13} className="text-novara-teal shrink-0" />
                  Proposal link: authenticated via a unique, single-use share token
                </span>
                <span className="flex items-center gap-1.5 text-novara-light/70">
                  <ShieldCheck size={13} className="text-novara-teal shrink-0" />
                  Signature file: integrity-checked on upload (valid image, not corrupted)
                </span>
                <span className="flex items-center gap-1.5 text-novara-light/70">
                  <ShieldCheck size={13} className="text-novara-teal shrink-0" />
                  Consent: explicit checkbox agreement captured and stored server-side
                </span>
              </div>
            </div>
          </div>
        )}

        {proposal.firstViewedAt && <ViewAnalyticsCard proposalId={proposal.id} acceptedAt={acceptance?.acceptedAt ?? null} />}

        {(proposal.firstViewedAt || acceptance) && <DownloadAuditReportButton proposalId={proposal.id} />}

        <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02]">
          <FormField label="Proposal Name" htmlFor="proposalName">
            <input
              id="proposalName"
              className={inputClass}
              value={form.proposalName ?? ''}
              onChange={(e) => setForm({ ...form, proposalName: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Client Name" htmlFor="clientName">
              <input
                id="clientName"
                className={inputClass}
                value={form.clientName ?? ''}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </FormField>
            <FormField label="Client First Name" htmlFor="clientFirstName">
              <input
                id="clientFirstName"
                className={inputClass}
                value={form.clientFirstName ?? ''}
                onChange={(e) => setForm({ ...form, clientFirstName: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Company Name" htmlFor="companyName">
            <input
              id="companyName"
              className={inputClass}
              value={form.companyName ?? ''}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Proposal Type" htmlFor="proposalType">
              <select
                id="proposalType"
                className={inputClass}
                value={form.proposalType ?? ''}
                onChange={(e) => setForm({ ...form, proposalType: e.target.value })}
              >
                {PROPOSAL_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" htmlFor="status">
              <select
                id="status"
                className={inputClass}
                value={form.status ?? proposal.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Proposal['status'] })}
              >
                {LIFECYCLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Prepared By" htmlFor="preparedBy">
            <input
              id="preparedBy"
              className={inputClass}
              value={form.preparedBy ?? ''}
              onChange={(e) => setForm({ ...form, preparedBy: e.target.value })}
            />
          </FormField>

          <FormField label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              rows={4}
              className={inputClass}
              placeholder="Internal notes about this proposal…"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedAt && (
            <span className="text-[12px] font-general-sans text-novara-teal">Saved</span>
          )}

          <div className="flex-1" />

          <button
            onClick={handleDuplicate}
            className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/70 hover:text-white px-3 py-2.5 rounded-lg border border-novara-border transition-colors"
          >
            <Copy size={15} /> Duplicate
          </button>
          {proposal.status !== 'archived' && (
            <button
              onClick={() => setConfirmArchive(true)}
              className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-red-300 hover:text-red-200 px-3 py-2.5 rounded-lg border border-red-400/25 transition-colors"
            >
              <Archive size={15} /> Archive
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-red-400 hover:text-red-300 px-3 py-2.5 rounded-lg border border-red-500/40 transition-colors"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {confirmArchive && (
        <ConfirmDialog
          title="Archive Proposal"
          message="This proposal will be moved to Archived. You can restore it at any time — nothing is deleted."
          confirmLabel="Archive"
          destructive
          onConfirm={handleConfirmArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Proposal"
          message={`This will permanently delete "${proposal.proposalName}" and everything attached to it (document, versions, notes, acceptance record). This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Permanently'}
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
