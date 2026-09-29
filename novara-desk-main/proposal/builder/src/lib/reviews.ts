import { supabase } from './supabaseClient.js'
import { updateProposal } from './proposals.js'
import { logActivity } from '../modules/activity/logActivity.js'
import { STATUS_LABELS, type Proposal, type ProposalStatus } from '../types/proposal.js'

const TABLE = 'proposal_builder_review_notes'

export interface ReviewNote {
  id: string
  proposalId: string
  reviewer: string
  comment: string
  resolved: boolean
  createdAt: string
}

interface ReviewNoteRow {
  id: string
  proposal_id: string
  reviewer: string
  comment: string
  resolved: boolean
  created_at: string
}

function fromRow(row: ReviewNoteRow): ReviewNote {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    reviewer: row.reviewer,
    comment: row.comment,
    resolved: row.resolved,
    createdAt: row.created_at,
  }
}

/** Appends a new review note. Never overwrites or edits any existing note. */
export async function addReviewNote(proposalId: string, reviewer: string, comment: string): Promise<ReviewNote> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ proposal_id: proposalId, reviewer, comment, resolved: false })
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as ReviewNoteRow)
}

/**
 * Changes a proposal's approval status AND appends a system-generated
 * review note documenting the change (reviewer + old→new status, plus an
 * optional free-text comment from the reviewer) — an append-only audit
 * trail, even though the Review page itself no longer shows a notes list.
 * Deliberately separate from the generic `updateProposal` (used by plain
 * metadata edits), so routine Save clicks on Proposal Detail never spam the
 * review log — only explicit approval-workflow transitions do.
 */
export async function changeApprovalStatus(
  proposal: Proposal,
  newStatus: ProposalStatus,
  reviewer: string,
  note?: string
): Promise<Proposal> {
  const updated = await updateProposal(proposal.id, { status: newStatus })
  const summary = `Status changed from "${STATUS_LABELS[proposal.status]}" to "${STATUS_LABELS[newStatus]}"`
  const comment = note?.trim() ? `${summary}\n\n${note.trim()}` : summary
  await addReviewNote(proposal.id, reviewer, comment)
  void logActivity({ proposalId: proposal.id, action: newStatus, actor: reviewer, detail: summary })
  return updated
}
