import { supabase } from './supabaseClient.js'
import { emptyProposalIntelligence, emptyQuestionsProgress, type ProposalIntelligence, type QuestionsProgress } from '../modules/intelligence/index.js'

const TABLE = 'proposal_intelligence'

export interface IntelligenceRecord {
  id: string
  proposalId: string
  createdAt: string
  updatedAt: string
  transcript: string
  intelligence: ProposalIntelligence
  questionsProgress: QuestionsProgress
}

interface IntelligenceRow {
  id: string
  proposal_id: string
  created_at: string
  updated_at: string
  transcript: string
  intelligence_data: Partial<ProposalIntelligence> | null
  questions_progress: Partial<QuestionsProgress> | null
}

function fromRow(row: IntelligenceRow): IntelligenceRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    transcript: row.transcript,
    intelligence: { ...emptyProposalIntelligence(), ...(row.intelligence_data ?? {}) },
    questionsProgress: { ...emptyQuestionsProgress(), ...(row.questions_progress ?? {}) },
  }
}

/** Null if this proposal has no saved Proposal Intelligence record yet. */
export async function getIntelligence(proposalId: string): Promise<IntelligenceRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, proposal_id, created_at, updated_at, transcript, intelligence_data, questions_progress')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? fromRow(data as IntelligenceRow) : null
}

/**
 * One record per proposal — upserts on proposal_id (see the unique index
 * in the migration), so re-analysing and re-saving updates the same row
 * rather than creating a history. Never writes to any Proposal Builder
 * table (proposals/documents/variables) — this stays a separate record
 * linked only by proposal_id.
 */
export async function saveIntelligence(proposalId: string, transcript: string, intelligence: ProposalIntelligence): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(TABLE).upsert(
    {
      proposal_id: proposalId,
      created_by: userData.user?.email ?? '',
      transcript,
      intelligence_data: intelligence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id' }
  )

  if (error) throw new Error(error.message)
}

/**
 * Phase 02 — Smart Follow-up Questions. Persists in-progress questions +
 * answers onto the SAME row saved in Phase 01 (never a second record),
 * so "Save Progress" and "Reload works" mean picking up exactly where the
 * user left off. Requires the Phase 01 row to already exist.
 */
export async function saveQuestionsProgress(proposalId: string, progress: QuestionsProgress): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ questions_progress: progress, updated_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
  if (error) throw new Error(error.message)
}

/**
 * Final step of Phase 02: writes the ProposalIntelligence object (with
 * answers already merged in by the caller — see
 * modules/intelligence/mergeAnswers.ts) and the completed questions
 * progress back onto the same row. Never creates a new record and never
 * touches any Proposal Builder table.
 */
export async function saveAnsweredIntelligence(proposalId: string, intelligence: ProposalIntelligence, progress: QuestionsProgress): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ intelligence_data: intelligence, questions_progress: progress, updated_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
  if (error) throw new Error(error.message)
}
