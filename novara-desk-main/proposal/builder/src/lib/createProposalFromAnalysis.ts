/**
 * Phase 04: the other deliberate exception to the AI Analysis modules'
 * usual isolation from the Proposal Builder (see modules/analysis/
 * toProposalSeed.ts) — orchestrates the EXISTING, unmodified Builder
 * creation/save path (createProposal, getDocumentByProposalId,
 * updateDocumentContent) to seed a brand-new proposal from a saved
 * Proposal Data record. Always creates a NEW proposal — never writes into
 * an existing one, so this can never clobber someone's in-progress manual
 * edits elsewhere in the Builder.
 */

import { supabase } from './supabaseClient.js'
import { createProposal } from './proposals.js'
import { getDocumentByProposalId, updateDocumentContent } from './documents.js'
import { buildProposalSeed, type ProposalData } from '../modules/analysis/index.js'

/**
 * `analysisId` is stored on the new proposal's `source_analysis_id` column
 * (see add_proposal_source_analysis.sql) via a direct update — a plain,
 * additive column read only by the Review page's "AI Analysis Summary",
 * so this stays a one-line addition rather than widening NewProposalInput/
 * ProposalUpdateInput (and every other Proposal Builder call site) for a
 * field only this flow ever sets.
 */
export async function createProposalFromProposalData(analysisId: string, proposalData: ProposalData): Promise<string> {
  const { input, variables, contentOverrides } = buildProposalSeed(proposalData)

  const proposal = await createProposal(input)
  const document = await getDocumentByProposalId(proposal.id)
  if (!document) throw new Error('Proposal document was not created')

  await updateDocumentContent(document, {
    variables: { ...document.variables, ...variables },
    contentOverrides: { ...document.contentOverrides, ...contentOverrides },
  })

  const { error } = await supabase
    .from('proposal_builder_proposals')
    .update({ source_analysis_id: analysisId })
    .eq('id', proposal.id)
  if (error) throw new Error(error.message)

  return proposal.id
}
