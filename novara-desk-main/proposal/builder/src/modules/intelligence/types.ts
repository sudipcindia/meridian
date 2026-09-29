/**
 * Proposal Intelligence Engine — Phase 01: understanding the client meeting
 * only. Fully independent of modules/analysis/* (an earlier, separate "AI
 * Analysis" tool with its own field set and its own standalone entry
 * point) and of the Proposal Builder's own types — this object is linked
 * to an existing proposal (by id) but never reads or writes the Builder's
 * variables/content-overrides/documents. This is the one structured
 * object every future AI phase will reuse and extend.
 */

export interface ProposalIntelligenceClient {
  firstName: string
  lastName: string
  fullName: string
  company: string
  /** Only set if explicitly mentioned in the transcript — never guessed. */
  email: string
  website: string
  industry: string
  businessType: string
  /** e.g. "10-50 employees" — free text, only if mentioned. */
  companySize: string
  location: string
}

export interface ProposalIntelligenceBusiness {
  currentSituation: string
  currentMarketing: string
  currentWebsite: string
  existingCRM: string
  existingAds: string
  existingSEO: string
}

/** Commercial terms for the proposed engagement — almost never present in a meeting transcript, so this is the one sub-object Smart Questions routinely has to fill via direct follow-up rather than extraction. */
export interface ProposalIntelligenceCommercial {
  /** Free text: package count, names, prices, and one-time/monthly cadence per package — kept as one paragraph rather than split per-package fields since the question engine only supports flat string/array targets. */
  packageDetails: string
  deposit: string
  paymentTerms: string
  contractDuration: string
  recommendedPackage: string
  optionalServices: string
  guarantees: string
}

export interface ProposalIntelligence {
  client: ProposalIntelligenceClient
  business: ProposalIntelligenceBusiness
  commercial: ProposalIntelligenceCommercial
  goals: string[]
  painPoints: string[]
  challenges: string[]
  objections: string[]
  urgency: string
  timeline: string
  competitors: string[]
  decisionMakers: string[]
  recommendedServices: string[]
  /** Free text, only if mentioned. */
  budget: string
  opportunities: string[]
  /** What Claude could not determine from the transcript — a list of gaps, not follow-up questions (that's a later phase). */
  missingInformation: string[]
  /** 0-100 — Claude's own confidence that this analysis reflects what was actually said. */
  confidenceScore: number
}

export function emptyProposalIntelligence(): ProposalIntelligence {
  return {
    client: {
      firstName: '',
      lastName: '',
      fullName: '',
      company: '',
      email: '',
      website: '',
      industry: '',
      businessType: '',
      companySize: '',
      location: '',
    },
    business: {
      currentSituation: '',
      currentMarketing: '',
      currentWebsite: '',
      existingCRM: '',
      existingAds: '',
      existingSEO: '',
    },
    commercial: {
      packageDetails: '',
      deposit: '',
      paymentTerms: '',
      contractDuration: '',
      recommendedPackage: '',
      optionalServices: '',
      guarantees: '',
    },
    goals: [],
    painPoints: [],
    challenges: [],
    objections: [],
    urgency: '',
    timeline: '',
    competitors: [],
    decisionMakers: [],
    recommendedServices: [],
    budget: '',
    opportunities: [],
    missingInformation: [],
    confidenceScore: 0,
  }
}

export interface AnalyzeMeetingRequest {
  transcript: string
}

export interface AnalyzeMeetingResponse {
  intelligence: ProposalIntelligence
}
