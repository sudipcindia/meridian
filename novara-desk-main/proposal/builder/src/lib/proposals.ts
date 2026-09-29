import { supabase } from './supabaseClient.js'
import { fromDocumentRow, createDocumentForProposal, duplicateDocument, type DocumentRow } from './documents.js'
import { logActivity } from '../modules/activity/logActivity.js'
import type { NewProposalInput, Proposal, ProposalStatus } from '../types/proposal.js'
import type { ProviderIdentity } from '../modules/branding/identity.js'
import type { ProposalDocument } from '../types/document.js'

const TABLE = 'proposal_builder_proposals'

/** Raw shape of a row in `proposal_builder_proposals` (snake_case, metadata only). */
interface ProposalRow {
  id: string
  client_name: string
  client_first_name: string
  company_name: string
  client_email: string
  proposal_name: string
  proposal_type: string
  status: ProposalStatus
  created_at: string
  updated_at: string
  prepared_by: string
  notes: string | null
  duplicated_from: string | null
  first_viewed_at: string | null
  provider_identity: ProviderIdentity
  // Embedded via the FK relation to proposal_builder_documents (one row, unique per proposal today).
  proposal_builder_documents: DocumentRow | null
}

/** Merges a metadata row + its Document into the single consumer-facing Proposal shape. */
function toProposal(row: ProposalRow, document: ProposalDocument): Proposal {
  return {
    id: row.id,
    clientName: row.client_name,
    clientFirstName: row.client_first_name,
    companyName: row.company_name,
    clientEmail: row.client_email ?? '',
    proposalName: row.proposal_name,
    proposalType: row.proposal_type,
    status: row.status,
    createdDate: row.created_at,
    updatedDate: row.updated_at,
    preparedBy: row.prepared_by,
    notes: row.notes ?? '',
    duplicatedFrom: row.duplicated_from,
    firstViewedAt: row.first_viewed_at,
    providerIdentity: row.provider_identity ?? 'novara',
    version: document.documentVersion,
    pages: document.pages,
  }
}

function fromRowWithDocument(row: ProposalRow): Proposal {
  // The unique index on proposal_builder_documents.proposal_id makes this a
  // true 1:1 relationship, so PostgREST should embed it as a single object —
  // but if its schema cache hasn't picked that constraint up yet (e.g. right
  // after a migration applied via the SQL Editor rather than a tracked
  // migration), it falls back to the 1:many array shape instead. Normalizing
  // here means this keeps working either way, without depending on cache
  // timing.
  const embedded = row.proposal_builder_documents as DocumentRow | DocumentRow[] | null
  const documentRow = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded
  if (!documentRow) {
    throw new Error(`Proposal ${row.id} has no Document — data integrity issue`)
  }
  return toProposal(row, fromDocumentRow(documentRow))
}

const SELECT_WITH_DOCUMENT = '*, proposal_builder_documents(*)'

export async function listProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_DOCUMENT)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as unknown as ProposalRow[]).map(fromRowWithDocument)
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_DOCUMENT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? fromRowWithDocument(data as unknown as ProposalRow) : null
}

/** Creates a new proposal record plus its first Document, derived from the frozen master template. */
export async function createProposal(input: NewProposalInput): Promise<Proposal> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      client_name: input.clientName,
      client_first_name: input.clientFirstName,
      company_name: input.companyName,
      client_email: input.clientEmail,
      proposal_name: input.proposalName,
      proposal_type: input.proposalType,
      prepared_by: input.preparedBy,
      notes: input.notes ?? '',
      status: 'draft',
      duplicated_from: null,
      provider_identity: input.providerIdentity,
    })
    .select('*')
    .single()

  if (error) throw error
  const row = data as ProposalRow
  const document = await createDocumentForProposal(row.id, {
    clientName: row.client_name,
    clientFirstName: row.client_first_name,
    companyName: row.company_name,
  })
  void logActivity({ proposalId: row.id, action: 'created', actor: 'staff' })
  return toProposal(row, document)
}

/** Duplicates an existing proposal AND its document into a new, fully independent copy. */
export async function duplicateProposal(sourceId: string): Promise<Proposal> {
  const source = await getProposal(sourceId)
  if (!source) throw new Error('Source proposal not found')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      client_name: source.clientName,
      client_first_name: source.clientFirstName,
      company_name: source.companyName,
      client_email: source.clientEmail,
      proposal_name: `${source.proposalName} (Copy)`,
      proposal_type: source.proposalType,
      prepared_by: source.preparedBy,
      notes: source.notes,
      status: 'draft',
      duplicated_from: source.id,
      provider_identity: source.providerIdentity,
    })
    .select('*')
    .single()

  if (error) throw error
  const row = data as ProposalRow

  // Fetch the source's document (embedded fields aren't available on `source`
  // itself since Proposal only exposes documentVersion/pages, not the id).
  const { data: sourceDocRow, error: docError } = await supabase
    .from('proposal_builder_documents')
    .select('*')
    .eq('proposal_id', sourceId)
    .single()
  if (docError) throw docError

  const newDocument = await duplicateDocument(fromDocumentRow(sourceDocRow as DocumentRow), row.id)
  return toProposal(row, newDocument)
}

export interface ProposalUpdateInput {
  clientName?: string
  clientFirstName?: string
  companyName?: string
  clientEmail?: string
  proposalName?: string
  proposalType?: string
  status?: ProposalStatus
  preparedBy?: string
  notes?: string
}

export async function updateProposal(id: string, patch: ProposalUpdateInput): Promise<Proposal> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.clientName !== undefined) dbPatch.client_name = patch.clientName
  if (patch.clientFirstName !== undefined) dbPatch.client_first_name = patch.clientFirstName
  if (patch.companyName !== undefined) dbPatch.company_name = patch.companyName
  if (patch.clientEmail !== undefined) dbPatch.client_email = patch.clientEmail
  if (patch.proposalName !== undefined) dbPatch.proposal_name = patch.proposalName
  if (patch.proposalType !== undefined) dbPatch.proposal_type = patch.proposalType
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.preparedBy !== undefined) dbPatch.prepared_by = patch.preparedBy
  if (patch.notes !== undefined) dbPatch.notes = patch.notes

  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq('id', id)
    .select(SELECT_WITH_DOCUMENT)
    .single()

  if (error) throw error
  return fromRowWithDocument(data as unknown as ProposalRow)
}

export async function archiveProposal(id: string): Promise<Proposal> {
  return updateProposal(id, { status: 'archived' })
}

export async function restoreProposal(id: string): Promise<Proposal> {
  return updateProposal(id, { status: 'draft' })
}

/**
 * Permanently removes a proposal row. Unlike archiveProposal (a status
 * change, fully reversible), this is a hard delete — its Document,
 * document_versions, acceptances, share links, etc. all cascade via the
 * existing FK `ON DELETE CASCADE` constraints (see add_proposal_builder.sql
 * and friends), no schema change needed. Callers must confirm with the
 * user first; there is no undo.
 */
export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
