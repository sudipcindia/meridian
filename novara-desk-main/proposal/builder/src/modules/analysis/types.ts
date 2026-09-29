/**
 * Phase 01 of the AI Proposal Generator: transcript analysis only.
 * This module is fully independent of ../ai (proposal section content
 * generation) and of the Proposal Builder's own types/proposal.ts — an
 * analysis is a standalone record, not a proposal or a document.
 */

export interface TranscriptAnalysisFields {
  clientName: string
  firstName: string
  lastName: string
  company: string
  website: string
  industry: string
  location: string
  businessType: string
  servicesRequired: string[]
  painPoints: string[]
  goals: string[]
  problems: string[]
  currentSituation: string
  competition: string
  budget: string
  timeline: string
  decisionMaker: string
  currentMarketing: string
  recommendedServices: string[]
  additionalNotes: string
}

/** Every field empty — the safe starting point before any analysis has run, and the fallback shape used to fill in anything a model response omits. */
export function emptyAnalysisFields(): TranscriptAnalysisFields {
  return {
    clientName: '',
    firstName: '',
    lastName: '',
    company: '',
    website: '',
    industry: '',
    location: '',
    businessType: '',
    servicesRequired: [],
    painPoints: [],
    goals: [],
    problems: [],
    currentSituation: '',
    competition: '',
    budget: '',
    timeline: '',
    decisionMaker: '',
    currentMarketing: '',
    recommendedServices: [],
    additionalNotes: '',
  }
}

export interface AnalyzeTranscriptRequest {
  transcript: string
}

export interface AnalyzeTranscriptResponse {
  analysis: TranscriptAnalysisFields
}

/**
 * Phase 02: missing-information follow-ups. A saved analysis's
 * `follow_up_answers` is a flat map keyed by FollowUpFieldKey — kept
 * separate from TranscriptAnalysisFields (Phase 01's fixed shape) so this
 * phase never has to widen or redefine that existing type.
 */
export type FollowUpAnswers = Record<string, string>

export interface FollowUpQuestion {
  key: string
  question: string
}

export interface FindMissingInfoRequest {
  analysis: TranscriptAnalysisFields
  existingAnswers: FollowUpAnswers
}

export interface FindMissingInfoResponse {
  questions: FollowUpQuestion[]
}

/**
 * Phase 03: Proposal Data synthesis — DATA ONLY, never proposal pages/HTML/
 * Markdown/CSS. Consolidates the transcript + Phase 01 analysis + Phase 02
 * follow-up answers into one clean structured object. Kept independent of
 * TranscriptAnalysisFields (different shape, different purpose) and of the
 * Proposal Builder's own types — whether/how this ever feeds into an actual
 * proposal is a separate, later decision.
 */
export interface ProposalData {
  clientName: string
  companyName: string
  website: string
  industry: string
  location: string
  painPoints: string[]
  goals: string[]
  services: string[]
  pricing: string
  recommendation: string
  cta: string
  summary: string
}

export function emptyProposalData(): ProposalData {
  return {
    clientName: '',
    companyName: '',
    website: '',
    industry: '',
    location: '',
    painPoints: [],
    goals: [],
    services: [],
    pricing: '',
    recommendation: '',
    cta: '',
    summary: '',
  }
}

export interface GenerateProposalDataRequest {
  transcript: string
  analysis: TranscriptAnalysisFields
  followUpAnswers: FollowUpAnswers
}

export interface GenerateProposalDataResponse {
  proposalData: ProposalData
}
