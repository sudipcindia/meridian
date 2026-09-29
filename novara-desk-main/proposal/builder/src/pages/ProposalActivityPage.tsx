import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { ProposalTabs } from '../components/ProposalTabs.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { getProposal } from '../lib/proposals.js'
import { listActivity, type ActivityEntry } from '../lib/activity.js'
import type { Proposal } from '../types/proposal.js'

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
  accepted: 'Client signed',
  archived: 'Archived',
  pdf_generated: 'PDF generated',
  audit_report_generated: 'Audit report downloaded',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')
}

/**
 * Activity tab — the first place the existing (previously write-only)
 * activity log is actually shown. Read-only, newest first; lets Sales/Ops
 * "track status" at a glance without digging through the database.
 */
export function ProposalActivityPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), listActivity(id)])
      .then(([p, a]) => {
        if (cancelled) return
        setProposal(p)
        setEntries(a)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load activity'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (error) return <div className="px-8 py-6"><ErrorBanner message={error} /></div>
  if (!proposal) return null

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="What's happened to this proposal, most recent first" />
      <div className="px-8"><ProposalTabs proposalId={id} /></div>

      <div className="px-8 py-6 flex flex-col gap-4 max-w-[900px]">
        {entries && entries.length === 0 && (
          <p className="text-sm font-general-sans text-novara-light/50">Nothing recorded yet.</p>
        )}

        {entries && entries.length > 0 && (
          <div className={analysisCardClass}>
            <div className="flex flex-col divide-y divide-novara-border">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-general-sans text-white/90">{actionLabel(entry.action)}</p>
                    <p className="text-[12px] font-general-sans text-novara-light/50">
                      {entry.actorName || entry.actor}
                      {entry.detail ? ` · ${entry.detail}` : ''}
                    </p>
                  </div>
                  <p className="text-[12px] font-general-sans text-novara-light/40 whitespace-nowrap pl-4">
                    {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
