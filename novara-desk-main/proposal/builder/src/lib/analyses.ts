import { supabase } from './supabaseClient.js'
import { emptyAnalysisFields, emptyProposalData, type FollowUpAnswers, type ProposalData, type TranscriptAnalysisFields } from '../modules/analysis/index.js'

const TABLE = 'proposal_builder_analyses'

export interface SaveAnalysisInput {
  transcript: string
  analysis: TranscriptAnalysisFields
}

/**
 * Saves a reviewed/edited transcript analysis as its own standalone record —
 * Phase 01 of the AI Proposal Generator. Never writes to any Proposal
 * Builder table (proposals/documents/variables) — this is intentionally a
 * separate record until a later phase decides how (or whether) an analysis
 * feeds into a proposal.
 */
export async function saveAnalysis(input: SaveAnalysisInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from(TABLE).insert({
    created_by: userData.user?.email ?? '',
    transcript: input.transcript,
    client_name: input.analysis.clientName,
    company_name: input.analysis.company,
    extracted_data: input.analysis,
  })

  if (error) throw new Error(error.message)
}

// ─── Phase 02: browsing a saved analysis + missing-information follow-ups ──

export interface AnalysisSummary {
  id: string
  createdAt: string
  clientName: string
  companyName: string
}

export interface AnalysisRecord extends AnalysisSummary {
  transcript: string
  analysis: TranscriptAnalysisFields
  followUpAnswers: FollowUpAnswers
  proposalData: ProposalData
}

interface AnalysisRow {
  id: string
  created_at: string
  client_name: string
  company_name: string
  transcript: string
  extracted_data: Partial<TranscriptAnalysisFields> | null
  follow_up_answers: FollowUpAnswers | null
  proposal_data: Partial<ProposalData> | null
}

function toSummary(row: Pick<AnalysisRow, 'id' | 'created_at' | 'client_name' | 'company_name'>): AnalysisSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    companyName: row.company_name,
  }
}

function toRecord(row: AnalysisRow): AnalysisRecord {
  return {
    ...toSummary(row),
    transcript: row.transcript,
    analysis: { ...emptyAnalysisFields(), ...(row.extracted_data ?? {}) },
    followUpAnswers: row.follow_up_answers ?? {},
    proposalData: { ...emptyProposalData(), ...(row.proposal_data ?? {}) },
  }
}

/** Newest first — used to pick which saved analysis to continue working on. */
export async function listAnalyses(): Promise<AnalysisSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, created_at, client_name, company_name')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSummary)
}

export async function getAnalysis(id: string): Promise<AnalysisRecord> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, created_at, client_name, company_name, transcript, extracted_data, follow_up_answers, proposal_data')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Analysis not found')
  return toRecord(data as AnalysisRow)
}

/**
 * The read side of the link written in lib/createProposalFromAnalysis.ts —
 * used only by the (simplified) Proposal Review page's "AI Analysis
 * Summary". Returns null for any proposal not created via the AI Proposal
 * Generator (no source_analysis_id), or if that analysis was since deleted.
 */
export async function getAnalysisSummaryForProposal(proposalId: string): Promise<AnalysisRecord | null> {
  const { data: proposalRow, error: proposalError } = await supabase
    .from('proposal_builder_proposals')
    .select('source_analysis_id')
    .eq('id', proposalId)
    .maybeSingle()
  if (proposalError || !proposalRow?.source_analysis_id) return null

  try {
    return await getAnalysis(proposalRow.source_analysis_id)
  } catch {
    return null
  }
}

/**
 * Records one follow-up answer against a saved analysis — UPDATES the same
 * row (never creates a new record, never touches extracted_data or any
 * Proposal Builder table). `currentAnswers` is merged with the new answer
 * client-side, then written back whole — safe for this single-staff-user
 * internal tool; a concurrent-edit race isn't a realistic risk here.
 */
export async function saveFollowUpAnswer(id: string, currentAnswers: FollowUpAnswers, key: string, value: string): Promise<FollowUpAnswers> {
  const merged: FollowUpAnswers = { ...currentAnswers, [key]: value }
  const { error } = await supabase.from(TABLE).update({ follow_up_answers: merged }).eq('id', id)
  if (error) throw new Error(error.message)
  return merged
}

// ─── Phase 03: Proposal Data synthesis ─────────────────────────────────────

/**
 * Saves the reviewed/edited Proposal Data — UPDATES the same analysis row
 * (never a new record, never touches the Proposal Builder). Re-saving after
 * a regenerate simply overwrites the previous proposal_data; no versioning
 * was asked for.
 */
export async function saveProposalData(id: string, proposalData: ProposalData): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ proposal_data: proposalData }).eq('id', id)
  if (error) throw new Error(error.message)
}
