import { apiFetch } from '../../lib/apiFetch.js'
import type {
  AnalyzeTranscriptResponse,
  FindMissingInfoResponse,
  FollowUpAnswers,
  FollowUpQuestion,
  GenerateProposalDataResponse,
  ProposalData,
  TranscriptAnalysisFields,
} from './types.js'

/**
 * All three calls below hit ONE consolidated serverless function
 * (api/ai/legacy-analysis.ts, dispatched via `action`) — merged from three
 * separate routes purely to stay under the Vercel Hobby plan's 12-function
 * deployment limit. Never Claude directly; no Anthropic API key is ever
 * present in this file (mirrors ../ai/client.ts).
 */
export async function analyzeTranscript(transcript: string): Promise<TranscriptAnalysisFields> {
  const res = await apiFetch('/api/ai/legacy-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ action: 'analyze', transcript }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Analysis request failed (${res.status})`)
  return (data as AnalyzeTranscriptResponse).analysis
}

/** Phase 02 — never Claude directly, same as analyzeTranscript above. */
export async function findMissingInfo(analysis: TranscriptAnalysisFields, existingAnswers: FollowUpAnswers): Promise<FollowUpQuestion[]> {
  const res = await apiFetch('/api/ai/legacy-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ action: 'missingInfo', analysis, existingAnswers }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return (data as FindMissingInfoResponse).questions
}

/** Phase 03 — never Claude directly, same as analyzeTranscript above. */
export async function generateProposalData(
  transcript: string,
  analysis: TranscriptAnalysisFields,
  followUpAnswers: FollowUpAnswers
): Promise<ProposalData> {
  const res = await apiFetch('/api/ai/legacy-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ action: 'proposalData', transcript, analysis, followUpAnswers }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return (data as GenerateProposalDataResponse).proposalData
}
