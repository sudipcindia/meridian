import type { ProposalIntelligence } from '../intelligence/index.js'
import type { ProposalBlueprint } from '../blueprint/index.js'
import type { ProposalContent } from '../salesContent/index.js'
import { INDUSTRY_TAXONOMY, type CtaLengthBucket, type Industry, type LearningOutcome, type LearningSignal } from './types.js'

/**
 * Pure, deterministic pattern extraction — NO AI call, NEVER copies
 * proposal text. Every field is either a count, a categorical tag
 * (matched against a small fixed keyword list), or a short style
 * descriptor that describes HOW a proposal was written rather than WHAT
 * was written about the client. This is the one place "learn patterns,
 * never copy text" is actually enforced in code.
 */

const STRATEGY_KEYWORD_TAGS: { keywords: string[]; tag: string }[] = [
  { keywords: ['seo'], tag: 'SEO' },
  { keywords: ['website', 'rebuild', 'redesign'], tag: 'Website Build' },
  { keywords: ['ads', 'ppc', 'paid media', 'paid ads'], tag: 'Paid Media' },
  { keywords: ['crm', 'automation'], tag: 'CRM & Automation' },
  { keywords: ['social'], tag: 'Social Media' },
  { keywords: ['content marketing', 'content strategy'], tag: 'Content Marketing' },
  { keywords: ['branding', 'brand identity'], tag: 'Branding' },
  { keywords: ['email'], tag: 'Email Marketing' },
]

const URGENCY_KEYWORDS = ['today', ' now', 'limited', 'this week', 'this month', "let's get started", 'ready when you are', 'act now', "don't wait", 'don’t wait']

function normalizeIndustry(raw: string): Industry {
  const trimmed = raw.trim().toLowerCase()
  return (INDUSTRY_TAXONOMY.find((i) => i !== 'Other' && i.toLowerCase() === trimmed) ?? 'Other') as Industry
}

function deriveStrategyTags(services: string[], strategyText: string): string[] {
  const haystack = [...services, strategyText].join(' ').toLowerCase()
  const tags = STRATEGY_KEYWORD_TAGS.filter(({ keywords }) => keywords.some((k) => haystack.includes(k))).map(({ tag }) => tag)
  return Array.from(new Set(tags))
}

function ctaLengthBucket(cta: string): CtaLengthBucket {
  const words = cta.trim().split(/\s+/).filter(Boolean).length
  if (words <= 12) return 'short'
  if (words <= 30) return 'medium'
  return 'long'
}

function ctaHasUrgency(cta: string): boolean {
  const lower = cta.toLowerCase()
  return URGENCY_KEYWORDS.some((k) => lower.includes(k))
}

function pick(contentValue: string | undefined, blueprintValue: string): string {
  const trimmed = contentValue?.trim()
  return trimmed ? trimmed : blueprintValue
}

export interface DeriveSignalInput {
  outcome: LearningOutcome
  intelligence: ProposalIntelligence
  blueprint: ProposalBlueprint
  content: ProposalContent | null
}

/** Omits id/proposalId/capturedAt/capturedBy — those are set by the caller (src/lib/learning.ts) at save time. */
export function deriveLearningSignal({ outcome, intelligence, blueprint, content }: DeriveSignalInput): Omit<LearningSignal, 'id' | 'proposalId' | 'capturedAt' | 'capturedBy'> {
  const services = blueprint.recommendedServices.length ? blueprint.recommendedServices : intelligence.recommendedServices
  const cta = pick(content?.pages.page11.envelopeMessage, blueprint.pages.page11.envelopeMessage)

  const narrativeLengths = [
    pick(content?.pages.page02.introParagraph, blueprint.pages.page02),
    pick(content?.pages.insightsBusiness.businessOverview, blueprint.pages.page03),
    pick(content?.pages.insightsGrowth.marketIndustryPosition, blueprint.pages.page04),
    pick(content?.pages.page05, blueprint.pages.page05),
    pick(content?.pages.page06, blueprint.pages.page06),
    pick(content?.pages.page07.description, blueprint.pages.page07),
  ]
  const proposalLength = narrativeLengths.reduce((sum, text) => sum + text.length, 0)

  const packageCount = content?.pages.page08.packageDescriptions.length || blueprint.pages.page08.packages.length

  return {
    outcome,
    industry: normalizeIndustry(intelligence.client.industry || blueprint.client.industry),
    services,
    strategyTags: deriveStrategyTags(services, blueprint.recommendedStrategy),
    painPointCount: intelligence.painPoints.length,
    proposalTone: blueprint.proposalTone,
    proposalLength,
    packageCount,
    ctaLengthBucket: ctaLengthBucket(cta),
    ctaHasUrgency: ctaHasUrgency(cta),
    confidenceScore: intelligence.confidenceScore,
  }
}
