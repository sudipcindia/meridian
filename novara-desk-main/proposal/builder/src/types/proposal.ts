import type { TemplatePageId } from '../masterTemplate/index.js'
import type { ProviderIdentity } from '../modules/branding/identity.js'

export type ProposalStatus =
  | 'draft'
  | 'internal_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'ready_for_pdf'
  | 'ready'
  | 'sent'
  | 'signed'
  | 'archived'

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'draft',
  'internal_review',
  'changes_requested',
  'approved',
  'rejected',
  'ready_for_pdf',
  'ready',
  'sent',
  'signed',
  'archived',
]

/**
 * The plain lifecycle statuses editable directly from Proposal Detail's
 * metadata form — trimmed to the Dashboard simplification's 5-status
 * vocabulary (Draft/Ready/Sent/Signed/Archived; see
 * modules/status/simpleStatus.ts). The approval-workflow statuses
 * (In Review, Changes Requested, Approved, Rejected, Ready for PDF) are
 * deliberately excluded here — they're reached only through the Review
 * panel's `changeApprovalStatus`, never this plain form, so this can't
 * become a second, unguarded way to set status="approved".
 */
export const LIFECYCLE_STATUSES: ProposalStatus[] = ['draft', 'ready', 'sent', 'signed', 'archived']

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  internal_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  ready_for_pdf: 'Ready for PDF',
  ready: 'Ready',
  sent: 'Sent',
  signed: 'Signed',
  archived: 'Archived',
}

/**
 * Proposal metadata only — who/what/status/ownership. Deliberately excludes
 * template content (pages, variables) and versioning, which live on the
 * proposal's Document (see `types/document.ts`). This split is what lets
 * future modules (PDF Export, eSignature, Audit Logs) read/write content
 * without ever touching client-facing record data, and vice versa.
 */
export interface ProposalMetadata {
  id: string
  clientName: string
  clientFirstName: string
  companyName: string
  /** Needed to send the secure client link (Phase 07) — empty until set. */
  clientEmail: string
  proposalName: string
  proposalType: string
  status: ProposalStatus
  createdDate: string
  updatedDate: string
  preparedBy: string
  notes: string
  duplicatedFrom: string | null
  /** Set once, the first time the client opens their link (Phase 08) — used only to derive the "Viewed" display status. */
  firstViewedAt: string | null
  /** Who this proposal represents as the provider/brand — 'novara' (default, Novara Consult) or 'upwork' (Jayson Kandiah personally). See modules/branding/identity.ts. */
  providerIdentity: ProviderIdentity
}

/**
 * Consumer-facing shape used throughout the UI: a Proposal's metadata
 * merged with a few read-mostly fields from its current Document, so
 * existing screens (list/table/detail) don't need to know the data comes
 * from two tables. `version` here is the Document's `documentVersion`.
 */
export interface Proposal extends ProposalMetadata {
  version: number
  pages: TemplatePageId[]
}

/** Shape accepted when creating a proposal — server fills id/dates/version. */
export interface NewProposalInput {
  clientName: string
  clientFirstName: string
  companyName: string
  clientEmail: string
  proposalName: string
  proposalType: string
  preparedBy: string
  notes?: string
  providerIdentity: ProviderIdentity
}

export const PROPOSAL_TYPE_OPTIONS = [
  'RevOps',
  'SEO',
  'PPC',
  'Web Design',
  'Full Growth Partnership',
] as const
