import { supabase } from '../../lib/supabaseClient.js'
import type { ProposalDocument } from '../../types/document.js'
import type { ContentOverrideMap, VariableMap } from '../variables/index.js'

const TABLE = 'proposal_builder_document_versions'

export interface DocumentVersionRecord {
  id: string
  documentId: string
  documentVersion: number
  variables: VariableMap
  contentOverrides: ContentOverrideMap
  editedBy: string
  summary: string
  createdAt: string
}

interface DocumentVersionRow {
  id: string
  document_id: string
  document_version: number
  variables: VariableMap
  content_overrides: ContentOverrideMap
  edited_by: string
  summary: string
  created_at: string
}

function fromRow(row: DocumentVersionRow): DocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    documentVersion: row.document_version,
    variables: row.variables ?? {},
    contentOverrides: row.content_overrides ?? {},
    editedBy: row.edited_by,
    summary: row.summary,
    createdAt: row.created_at,
  }
}

/**
 * Appends one version-history row for a just-saved document — a full
 * snapshot (not a diff), so a future restore phase can use it directly
 * without replay logic. Called once per successful save; never called for
 * the master template, which has no version history of its own.
 */
export async function recordDocumentVersion(
  document: ProposalDocument,
  editedBy: string,
  summary: string
): Promise<DocumentVersionRecord> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      document_id: document.id,
      document_version: document.documentVersion,
      variables: document.variables,
      content_overrides: document.contentOverrides,
      edited_by: editedBy,
      summary,
    })
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as DocumentVersionRow)
}

/** Read-only history for a document, newest first. Not called from any UI this phase — reserved for a future restore flow. */
export async function listDocumentVersions(documentId: string): Promise<DocumentVersionRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as DocumentVersionRow[]).map(fromRow)
}
