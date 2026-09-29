import type { ProposalBlueprint } from '../blueprint/index.js'

/**
 * Proposal Intelligence Engine — Phase 06: Business Impact Engine.
 * Structured commercial calculations and projections generated from the
 * Proposal Blueprint's verified facts — never invented, never fabricated.
 * This is a standalone, reviewable record: there is no chart/table/
 * progress-indicator rendering capability anywhere in the Proposal
 * Builder today (verified before building this module), so nothing here
 * is written into any proposal page — see modules/blueprintPopulate's
 * "Not Yet Available" list, which surfaces this gap explicitly.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** Known = the client explicitly stated this. Estimated = derived by calculation from known facts. Assumed = an industry-standard assumption with no specific client data behind it. */
export type DataQuality = 'known' | 'estimated' | 'assumed'

export interface ImpactMetric {
  label: string
  /** Current baseline, if known or derivable — '' if genuinely not available (never fabricated). */
  currentValue: string
  /** Projected value after working with Novara. */
  projectedValue: string
  /** Plain-English summary of the estimated change, e.g. "+20-30% increase in qualified leads". */
  estimatedChange: string
  confidence: ConfidenceLevel
  dataQuality: DataQuality
  /** Required whenever dataQuality is 'estimated' or 'assumed' — empty only when dataQuality is 'known'. */
  assumptions: string[]
}

export interface BusinessImpact {
  leadGrowth: ImpactMetric
  revenueGrowth: ImpactMetric
  lostOpportunities: ImpactMetric
  conversionImprovement: ImpactMetric
  marketingEfficiency: ImpactMetric
  pipelineImprovement: ImpactMetric
  operationalTimeSavings: ImpactMetric
  salesProcessImprovement: ImpactMetric
  customerAcquisitionImprovement: ImpactMetric
  potentialROI: ImpactMetric
  /** A short executive summary tying the calculations together — must state clearly that figures are estimates based on the information provided wherever that's true. */
  overallSummary: string
}

function emptyMetric(label: string): ImpactMetric {
  return { label, currentValue: '', projectedValue: '', estimatedChange: '', confidence: 'low', dataQuality: 'assumed', assumptions: [] }
}

export function emptyBusinessImpact(): BusinessImpact {
  return {
    leadGrowth: emptyMetric('Potential Lead Growth'),
    revenueGrowth: emptyMetric('Potential Revenue Growth'),
    lostOpportunities: emptyMetric('Estimated Lost Opportunities'),
    conversionImprovement: emptyMetric('Conversion Improvement'),
    marketingEfficiency: emptyMetric('Marketing Efficiency'),
    pipelineImprovement: emptyMetric('Pipeline Improvement'),
    operationalTimeSavings: emptyMetric('Operational Time Savings'),
    salesProcessImprovement: emptyMetric('Sales Process Improvement'),
    customerAcquisitionImprovement: emptyMetric('Customer Acquisition Improvement'),
    potentialROI: emptyMetric('Potential Return on Investment'),
    overallSummary: '',
  }
}

export interface GenerateImpactRequest {
  blueprint: ProposalBlueprint
}

export interface GenerateImpactResponse {
  impact: BusinessImpact
}
