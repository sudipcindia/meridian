import type { ProposalStatus } from '../../types/proposal.js'

/**
 * The brief's Ops Intel dashboard vocabulary (Draft, Review, Approved,
 * Sent, Viewed, Accepted, Rejected, Archived) doesn't map 1:1 onto the real
 * `ProposalStatus` enum, and shouldn't — SENDABLE_STATUSES/ALLOWED_STATUSES/
 * VIEWABLE_STATUSES gating across Phases 05-07 is keyed off the existing
 * status strings, and a passive page-open shouldn't mutate lifecycle
 * state. This is a pure presentation-layer derivation on top of the real
 * status + `first_viewed_at`, used only for display (Ops Intel, dashboards)
 * — never for gating.
 */
export type DisplayStatus = 'Draft' | 'Review' | 'Approved' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected' | 'Archived'

export function getDisplayStatus(status: ProposalStatus, firstViewedAt: string | null): DisplayStatus {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'internal_review':
    case 'changes_requested':
      return 'Review'
    case 'approved':
    case 'ready_for_pdf':
    case 'ready':
      return 'Approved'
    case 'sent':
      return firstViewedAt ? 'Viewed' : 'Sent'
    case 'signed':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    case 'archived':
      return 'Archived'
  }
}
