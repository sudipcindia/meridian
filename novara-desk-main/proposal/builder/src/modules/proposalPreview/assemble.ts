import type { ProposalIntelligence } from '../intelligence/index.js'
import type { ProposalBlueprint } from '../blueprint/index.js'
import type { ProposalContent } from '../salesContent/index.js'
import type { BusinessImpact } from '../businessImpact/index.js'
import type { PreviewSection, PreviewSourcePhase } from './types.js'

/** Sales Content (Phase 05) is preferred over the Blueprint's (Phase 03) own page content when both exist — the same precedence rule Builder Population already applies (modules/blueprintPopulate/mapping.ts's `pick`). */
function pick(contentValue: string | undefined, blueprintValue: string): { value: string; source: PreviewSourcePhase } {
  const trimmed = contentValue?.trim()
  return trimmed ? { value: trimmed, source: 'content' } : { value: blueprintValue, source: 'blueprint' }
}

/**
 * Combines the four existing, already-saved AI records into the nine
 * canonical Proposal Preview sections. Pure function, no I/O, no new
 * generation — this phase's whole job is combining outputs already
 * produced by earlier phases, never duplicating their logic.
 */
export function assemblePreviewSections(
  intelligence: ProposalIntelligence,
  blueprint: ProposalBlueprint,
  content: ProposalContent | null,
  impact: BusinessImpact
): PreviewSection[] {
  const businessSummary = pick(content?.pages.page02.companyUnderstanding, blueprint.client.businessSummary)
  const keyStrategy = pick(content?.pages.page05, blueprint.recommendedStrategy)
  const investmentSummary = pick(
    content?.pages.page08.investmentExplanation,
    [blueprint.pricingStrategy, blueprint.investmentRecommendation].filter(Boolean).join('\n\n')
  )

  const outcomeLines = [impact.leadGrowth, impact.revenueGrowth, impact.conversionImprovement, impact.potentialROI]
    .filter((m) => m.estimatedChange.trim())
    .map((m) => `${m.label}: ${m.estimatedChange} (${m.confidence} confidence, ${m.dataQuality})`)

  const sections: PreviewSection[] = [
    {
      id: 'clientSummary',
      label: 'Client Summary',
      value: [intelligence.client.fullName, intelligence.client.company, intelligence.client.industry, intelligence.client.location]
        .filter(Boolean)
        .join(' — '),
      sourcePhase: 'intelligence',
      canRegenerate: false,
    },
    {
      id: 'businessSummary',
      label: 'Business Summary',
      value: businessSummary.value,
      sourcePhase: businessSummary.source,
      canRegenerate: true,
    },
    {
      id: 'painPoints',
      label: 'Pain Points',
      value: intelligence.painPoints.join('\n'),
      sourcePhase: 'intelligence',
      canRegenerate: false,
    },
    {
      id: 'goals',
      label: 'Goals',
      value: intelligence.goals.join('\n'),
      sourcePhase: 'intelligence',
      canRegenerate: false,
    },
    {
      id: 'recommendedServices',
      label: 'Recommended Services',
      value: intelligence.recommendedServices.join('\n'),
      sourcePhase: 'intelligence',
      canRegenerate: false,
    },
    {
      id: 'keyStrategy',
      label: 'Key Strategy',
      value: keyStrategy.value,
      sourcePhase: keyStrategy.source,
      canRegenerate: true,
    },
    {
      id: 'investmentSummary',
      label: 'Investment Summary',
      value: investmentSummary.value,
      sourcePhase: investmentSummary.source,
      canRegenerate: true,
    },
    {
      id: 'businessImpact',
      label: 'Business Impact',
      value: impact.overallSummary,
      sourcePhase: 'impact',
      canRegenerate: true,
    },
    {
      id: 'estimatedOutcomes',
      label: 'Estimated Outcomes',
      value: outcomeLines.join('\n'),
      sourcePhase: 'impact',
      canRegenerate: true,
    },
  ]

  return sections.filter((s) => s.value.trim() !== '')
}
