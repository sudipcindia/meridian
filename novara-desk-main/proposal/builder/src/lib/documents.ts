import { supabase } from './supabaseClient.js'
import { MASTER_TEMPLATE, insertDynamicInsightPages, type DynamicInsightPageId } from '../masterTemplate/index.js'
import {
  getDefaultVariables,
  type ContentOverrideMap,
  type VariableMap,
  type VariableSeedSource,
} from '../modules/variables/index.js'
import type { ProposalDocument } from '../types/document.js'

const TABLE = 'proposal_builder_documents'

/** Raw shape of a row in `proposal_builder_documents` (snake_case, as stored). */
export interface DocumentRow {
  id: string
  proposal_id: string
  master_template_version: number
  document_version: number
  pages: ProposalDocument['pages']
  variables: VariableMap
  content_overrides: ContentOverrideMap
  created_at: string
  updated_at: string
}

export function fromDocumentRow(row: DocumentRow): ProposalDocument {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    masterTemplateVersion: row.master_template_version,
    documentVersion: row.document_version,
    pages: row.pages,
    variables: row.variables ?? {},
    contentOverrides: row.content_overrides ?? {},
    createdDate: row.created_at,
    updatedDate: row.updated_at,
  }
}

/**
 * Creates the first Document instance for a brand-new proposal, always
 * derived from the frozen master template — never from another document.
 * Variables are pre-seeded from the proposal's own metadata (client/company
 * name); placeholders with no metadata equivalent are left for the future
 * Proposal Editor to fill in.
 */
export async function createDocumentForProposal(
  proposalId: string,
  seed: VariableSeedSource
): Promise<ProposalDocument> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      proposal_id: proposalId,
      master_template_version: MASTER_TEMPLATE.version,
      document_version: 1,
      pages: MASTER_TEMPLATE.pages,
      variables: getDefaultVariables(seed),
      content_overrides: {},
    })
    .select('*')
    .single()

  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

/** Duplicates an existing document (used when a proposal is duplicated) as a fresh, independent copy. */
export async function duplicateDocument(
  sourceDocument: ProposalDocument,
  newProposalId: string
): Promise<ProposalDocument> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      proposal_id: newProposalId,
      master_template_version: sourceDocument.masterTemplateVersion,
      document_version: 1,
      pages: sourceDocument.pages,
      variables: sourceDocument.variables,
      content_overrides: sourceDocument.contentOverrides,
    })
    .select('*')
    .single()

  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

export async function getDocumentByProposalId(proposalId: string): Promise<ProposalDocument | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (error) throw error
  return data ? fromDocumentRow(data as DocumentRow) : null
}

/**
 * Inserts (or replaces) the Content Architect's decided set of dynamic
 * insight pages into `document.pages`, bumping `documentVersion` in the
 * same write — the first thing in this codebase to mutate `pages` after
 * creation. Bumping documentVersion here matters concretely: it's what the
 * PDF cache (see modules/pdf's proposalPdfAdapter) keys off, so without
 * this a stale-page-count PDF could serve from cache even though the live
 * document now has more pages. Called once, from autoGenerateProposal,
 * immediately after the Content Architect's plan is decided — idempotent
 * at the call site (autoGenerateProposal only calls this when `pages`
 * doesn't already contain the target set), so a retried/resumed auto-flow
 * never double-bumps the version for the same insertion.
 */
export async function setDynamicInsightPages(document: ProposalDocument, ids: readonly DynamicInsightPageId[]): Promise<ProposalDocument> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      pages: insertDynamicInsightPages(document.pages, ids),
      document_version: document.documentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id)
    .select('*')
    .single()

  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}

export interface DocumentContentUpdate {
  variables: VariableMap
  contentOverrides: ContentOverrideMap
}

/**
 * Saves new variables and/or content overrides for a proposal's document
 * and bumps `documentVersion` — this is the "content edited/saved" event
 * that field is defined to track. The single save path used by both the
 * Variables panel, the Proposal Editor's autosave, and its manual Save
 * button. Only ever writes to the proposal's own duplicated document,
 * never the master template.
 */
export async function updateDocumentContent(
  document: ProposalDocument,
  content: DocumentContentUpdate
): Promise<ProposalDocument> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      variables: content.variables,
      content_overrides: content.contentOverrides,
      document_version: document.documentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id)
    .select('*')
    .single()

  if (error) throw error
  return fromDocumentRow(data as DocumentRow)
}
