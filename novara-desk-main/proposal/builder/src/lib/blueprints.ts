import { supabase } from './supabaseClient.js'
import { emptyProposalBlueprint, type ProposalBlueprint } from '../modules/blueprint/index.js'

const TABLE = 'proposal_blueprints'

export interface BlueprintRecord {
  id: string
  proposalId: string
  createdAt: string
  updatedAt: string
  blueprint: ProposalBlueprint
}

interface BlueprintRow {
  id: string
  proposal_id: string
  created_at: string
  updated_at: string
  blueprint_data: Partial<ProposalBlueprint> | null
}

function fromRow(row: BlueprintRow): BlueprintRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blueprint: { ...emptyProposalBlueprint(), ...(row.blueprint_data ?? {}) },
  }
}

/** Null if this proposal has no saved Proposal Blueprint yet. */
export async function getBlueprint(proposalId: string): Promise<BlueprintRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, proposal_id, created_at, updated_at, blueprint_data')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? fromRow(data as BlueprintRow) : null
}

/**
 * One record per proposal — upserts on proposal_id (see the unique index
 * in the migration), so re-generating and re-saving updates the same row
 * rather than creating a history. Never writes to any Proposal Builder
 * table (proposals/documents/variables) and never touches
 * proposal_intelligence — this is Phase 03's own, separate record, linked
 * only by proposal_id.
 */
export async function saveBlueprint(proposalId: string, blueprint: ProposalBlueprint): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(TABLE).upsert(
    {
      proposal_id: proposalId,
      created_by: userData.user?.email ?? '',
      blueprint_data: blueprint,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id' }
  )

  if (error) throw new Error(error.message)
}
