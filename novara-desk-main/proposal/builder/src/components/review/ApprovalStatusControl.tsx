import { useState } from 'react'
import { changeApprovalStatus } from '../../lib/reviews.js'
import type { Proposal } from '../../types/proposal.js'
import { StatusBadge } from '../StatusBadge.js'
import { ErrorBanner } from '../ErrorBanner.js'

interface ApprovalStatusControlProps {
  proposal: Proposal
  onStatusChanged: (updated: Proposal) => void
}

const APPROVABLE_FROM: Proposal['status'][] = ['approved', 'sent', 'signed', 'archived']

/** Simplified Review workflow: Draft → Review → Approve → Send — one action, no dropdown, no reject. */
export function ApprovalStatusControl({ proposal, onStatusChanged }: ApprovalStatusControlProps) {
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setApproving(true)
    setError(null)
    try {
      const updated = await changeApprovalStatus(proposal, 'approved', 'Staff')
      onStatusChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve proposal')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-clash-display text-white text-[16px]">Proposal Status</p>
        <StatusBadge status={proposal.status} />
      </div>

      {error && <ErrorBanner message={error} />}

      <button
        onClick={() => void handleApprove()}
        disabled={approving || APPROVABLE_FROM.includes(proposal.status)}
        className="self-start text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        {approving ? 'Approving…' : 'Approve'}
      </button>
    </div>
  )
}
