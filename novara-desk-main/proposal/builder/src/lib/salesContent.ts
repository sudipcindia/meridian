import { supabase } from './supabaseClient.js'
import { emptyProposalContent, type ProposalContent } from '../modules/salesContent/index.js'

const TABLE = 'proposal_content'

export interface ContentRecord {
  id: string
  proposalId: string
  createdAt: string
  updatedAt: string
  content: ProposalContent
}

interface ContentRow {
  id: string
  proposal_id: string
  created_at: string
  updated_at: string
  content_data: Partial<ProposalContent> | null
}

/** Before Phase 2, `pages.page07` was a single plain string (just today's `description` field). The top-level merge below is shallow — it can add a brand-new field to an unseen sub-object safely, but a field whose SHAPE changed (string → object) survives verbatim from the stored row and clobbers the default entirely. Detected here and migrated into `.description` so an old proposal's already-generated copy isn't silently discarded, and so every other field (`.trim()`, `.description`, etc.) can safely assume the current object shape. */
function migrateLegacyPage07(content: ProposalContent): ProposalContent {
  const page07 = content.pages.page07 as unknown
  if (typeof page07 !== 'string') return content
  return { ...content, pages: { ...content.pages, page07: { ...emptyProposalContent().pages.page07, description: page07 } } }
}

function fromRow(row: ContentRow): ContentRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    content: migrateLegacyPage07({ ...emptyProposalContent(), ...(row.content_data ?? {}) }),
  }
}

/** Null if this proposal has no saved Sales Content yet. */
export async function getContent(proposalId: string): Promise<ContentRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, proposal_id, created_at, updated_at, content_data')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? fromRow(data as ContentRow) : null
}

/**
 * One record per proposal — upserts on proposal_id (see the unique index
 * in the migration), so re-generating and re-saving updates the same row
 * rather than creating a history. Never writes to any Proposal Builder
 * table and never touches proposal_intelligence/proposal_blueprints —
 * this is Phase 05's own, separate record, linked only by proposal_id.
 */
export async function saveContent(proposalId: string, content: ProposalContent): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(TABLE).upsert(
    {
      proposal_id: proposalId,
      created_by: userData.user?.email ?? '',
      content_data: content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id' }
  )

  if (error) throw new Error(error.message)
}
