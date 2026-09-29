import { supabase } from './supabaseClient.js'
import { emptyBusinessImpact, type BusinessImpact } from '../modules/businessImpact/index.js'

const TABLE = 'proposal_business_impact'

export interface BusinessImpactRecord {
  id: string
  proposalId: string
  createdAt: string
  updatedAt: string
  impact: BusinessImpact
}

interface BusinessImpactRow {
  id: string
  proposal_id: string
  created_at: string
  updated_at: string
  impact_data: Partial<BusinessImpact> | null
}

function fromRow(row: BusinessImpactRow): BusinessImpactRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    impact: { ...emptyBusinessImpact(), ...(row.impact_data ?? {}) },
  }
}

/** Null if this proposal has no saved Business Impact calculations yet. */
export async function getBusinessImpact(proposalId: string): Promise<BusinessImpactRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, proposal_id, created_at, updated_at, impact_data')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? fromRow(data as BusinessImpactRow) : null
}

/**
 * One record per proposal — upserts on proposal_id (see the unique index
 * in the migration), so re-generating and re-saving updates the same row
 * rather than creating a history. Never writes to any Proposal Builder
 * table and never touches proposal_intelligence/proposal_blueprints/
 * proposal_content — this is Phase 06's own, separate record, linked
 * only by proposal_id.
 */
export async function saveBusinessImpact(proposalId: string, impact: BusinessImpact): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(TABLE).upsert(
    {
      proposal_id: proposalId,
      created_by: userData.user?.email ?? '',
      impact_data: impact,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id' }
  )

  if (error) throw new Error(error.message)
}
