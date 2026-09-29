import type { ProposalStatus } from '../../types/proposal.js'

/**
 * The 5-status vocabulary the simplified Proposal Dashboard shows to
 * Sales/Ops/Management: Draft, Ready, Sent, Signed, Archived. This is a
 * pure presentation-layer grouping on top of the real `ProposalStatus` —
 * never used for gating (SENDABLE_STATUSES/PDF_VIEWABLE_STATUSES/etc. in
 * modules/status/gates.ts are unchanged and remain the real security/
 * workflow boundary). The underlying enum, DB CHECK constraint, and
 * Review page's Approve action are untouched — a proposal can still be
 * 'approved' internally; the dashboard just displays and filters it as
 * "Ready" alongside 'ready_for_pdf'/'ready', since from a salesperson's
 * point of view both mean "ready to send".
 */
export type SimpleStatus = 'draft' | 'ready' | 'sent' | 'signed' | 'archived'

export const SIMPLE_STATUSES: SimpleStatus[] = ['draft', 'ready', 'sent', 'signed', 'archived']

export const SIMPLE_STATUS_LABELS: Record<SimpleStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  sent: 'Sent',
  signed: 'Signed',
  archived: 'Archived',
}

export function toSimpleStatus(status: ProposalStatus): SimpleStatus {
  switch (status) {
    case 'draft':
    case 'internal_review':
    case 'changes_requested':
    case 'rejected':
      return 'draft'
    case 'approved':
    case 'ready_for_pdf':
    case 'ready':
      return 'ready'
    case 'sent':
      return 'sent'
    case 'signed':
      return 'signed'
    case 'archived':
      return 'archived'
  }
}
