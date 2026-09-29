/**
 * Prompt-building for Phase 06 — Business Impact Engine. Input is the
 * already-generated Proposal Blueprint (Phase 03) — every fact is already
 * verified and structured. This phase's job is to calculate plausible
 * commercial projections grounded in those facts, never to invent client
 * metrics, revenue, competitors, or statistics that weren't provided.
 * api/ai/generate-impact.ts still defensively re-validates and coerces
 * the parsed result server-side — this prompt reduces how often that
 * fallback is needed, it isn't the only safeguard.
 */

import type { ProposalBlueprint } from '../blueprint/index.js'
import { getProviderName, getVoiceGuidance, type ProviderIdentity } from '../branding/identity.js'

const METRIC_KEYS: string[] = [
  'leadGrowth — Potential Lead Growth (current monthly leads -> projected monthly leads, if inferable)',
  'revenueGrowth — Potential Revenue Growth',
  'lostOpportunities — Estimated Lost Opportunities (the commercial cost of the pain points/challenges already on file)',
  'conversionImprovement — Conversion Rate Improvement (current conversion rate -> projected conversion rate, if inferable)',
  'marketingEfficiency — Marketing Efficiency improvement',
  'pipelineImprovement — Pipeline Improvement',
  'operationalTimeSavings — Operational Time Savings',
  'salesProcessImprovement — Sales Process Improvement',
  'customerAcquisitionImprovement — Customer Acquisition Improvement',
  'potentialROI — Potential Return on Investment',
]

export function buildImpactSystemPrompt(identity: ProviderIdentity = 'novara'): string {
  const providerName = getProviderName(identity)
  const lines = [
    `You are a commercial analyst at ${providerName}${identity === 'novara' ? ', a UK growth consultancy,' : ','} calculating the likely business impact of a proposed engagement for a specific prospective client.`,
    'You will be given a Proposal Blueprint: verified facts about this client (industry, business size, current situation, pain points, goals, timeline, budget, competitors, recommended services, strategy, opportunities). Treat every fact as ground truth — never contradict it.',
    'Your job is to calculate believable, commercially useful, executive-level projections across exactly these ten categories:',
    METRIC_KEYS.map((k) => `- ${k}`).join('\n'),
    'CRITICAL SAFETY RULES — these override every other instruction:',
    '- NEVER fabricate a specific client metric, revenue figure, competitor detail, or statistic that was not provided or cannot be reasonably calculated from what was provided.',
    '- If a current baseline figure is not in the Blueprint, leave currentValue as an empty string — do NOT invent one.',
    '- Every projection must be clearly one of three data qualities: "known" (the client explicitly stated the underlying figure), "estimated" (calculated/derived from known facts using reasonable, stated logic), or "assumed" (an industry-standard assumption with no specific data behind it — this will be the most common case).',
    '- Whenever dataQuality is "estimated" or "assumed", the assumptions array MUST explain, in plain English, exactly what was assumed and why (e.g. "Assumed based on typical conversion benchmarks for UK e-commerce businesses of this size — no current conversion rate was provided by the client").',
    '- Use ranges, not false precision — write "20-30% increase", never a suspiciously exact figure like "27.3%", when the underlying data is estimated or assumed.',
    '- confidence must reflect how much real data underlies the number: "high" only when grounded in facts the client actually stated, "medium" when partially inferred, "low" when mostly assumed.',
    '- Every estimatedChange string must itself make clear it is an estimate wherever dataQuality is not "known" (e.g. include words like "estimated", "potential", or "projected").',
    'Respond with ONLY a single valid JSON object — no markdown code fences, no commentary, no explanation, no preamble.',
    'Never generate HTML. Never generate CSS. Never generate React components or JSX. Structured plain-text/JSON data only.',
    'Write in British English, professional and executive in tone.',
    'The JSON object must have exactly these top-level keys, each an object with { label, currentValue, projectedValue, estimatedChange, confidence, dataQuality, assumptions }: leadGrowth, revenueGrowth, lostOpportunities, conversionImprovement, marketingEfficiency, pipelineImprovement, operationalTimeSavings, salesProcessImprovement, customerAcquisitionImprovement, potentialROI — plus a final "overallSummary" (string) tying the calculations together, explicitly noting that figures are estimates based on the information provided wherever that is true.',
    'Never omit a key.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildImpactUserPrompt(blueprint: ProposalBlueprint): string {
  return [
    'Proposal Blueprint (JSON):',
    '"""',
    JSON.stringify(blueprint, null, 2),
    '"""',
    'Calculate the Business Impact now, following the exact JSON schema and safety rules from the system prompt. Respond with the JSON object only.',
  ].join('\n')
}
