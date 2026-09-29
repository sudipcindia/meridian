/**
 * Phase 04: connects Proposal Data (Phase 03) to the EXISTING Proposal
 * Builder — the one deliberate exception to every earlier phase's rule of
 * staying fully isolated from the Builder's own types/lib/modules. This is
 * a pure mapping function only: no I/O, no Supabase, no side effects.
 *
 * Maps Proposal Data onto fields the Builder already understands and
 * already renders as editable, click-to-edit text:
 *   - NewProposalInput (proposal metadata)
 *   - the 7 existing template VariableKeys + the existing AI-context
 *     variable keys (industry/services/goals/budget) — see modules/ai/
 *     sections.ts's AI_CONTEXT_FIELDS, already a real part of
 *     Document.variables
 *   - a handful of EXISTING hand-authored content-override keys
 *     (cover.paragraph, page07.keywords, page08.recommendedIntro,
 *     page10.companyName/clientName, page11.envelopeMessage) — every one
 *     of these already exists, already has a default, and is already
 *     wired into ProposalEditor.tsx's click-to-edit popover. Nothing new
 *     is introduced, nothing is renamed, no layout/template file changes.
 *
 * A field is only ever set when the source value is non-empty, so an
 * incomplete Proposal Data record can never blank out a good template
 * default — this keeps every page's approved layout and copy intact
 * wherever Proposal Data has nothing to say.
 */

import type { NewProposalInput } from '../../types/proposal.js'
import type { ContentOverrideMap, VariableMap } from '../variables/index.js'
import { serializeCollection } from '../variables/index.js'
import type { ProposalData } from './types.js'

export interface ProposalSeed {
  input: NewProposalInput
  variables: Partial<VariableMap>
  contentOverrides: Partial<ContentOverrideMap>
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

export function buildProposalSeed(data: ProposalData): ProposalSeed {
  const clientFirstName = firstName(data.clientName)

  const input: NewProposalInput = {
    clientName: data.clientName,
    clientFirstName,
    companyName: data.companyName,
    clientEmail: '',
    proposalName: `${data.companyName || data.clientName} Proposal`.trim(),
    proposalType: 'RevOps',
    preparedBy: 'Jayson Kandiah',
    notes: data.summary,
    providerIdentity: 'novara',
  }

  const variables: Partial<VariableMap> = {}
  if (data.clientName) variables.clientName = data.clientName
  if (clientFirstName) variables.clientFirstName = clientFirstName
  if (data.companyName) {
    variables.companyName = data.companyName
    variables.businessName = data.companyName
  }
  if (data.website) variables.websiteLink = data.website
  if (data.location) variables.location = data.location
  if (data.services.length) {
    variables.serviceType = data.services[0]
    variables.services = data.services.join(', ')
  }
  if (data.industry) variables.industry = data.industry
  if (data.goals.length) variables.goals = data.goals.join(', ')
  if (data.pricing) variables.budget = data.pricing

  const contentOverrides: Partial<ContentOverrideMap> = {}
  if (data.summary) contentOverrides['cover.paragraph'] = data.summary
  const keywordSource = data.painPoints.length ? data.painPoints : data.goals
  if (keywordSource.length) contentOverrides['page07.keywords'] = serializeCollection(keywordSource)
  if (data.recommendation) contentOverrides['page08.recommendedIntro'] = data.recommendation
  if (data.companyName) contentOverrides['page10.companyName'] = data.companyName
  if (data.clientName) contentOverrides['page10.clientName'] = data.clientName
  if (data.cta) contentOverrides['page11.envelopeMessage'] = data.cta

  return { input, variables, contentOverrides }
}
