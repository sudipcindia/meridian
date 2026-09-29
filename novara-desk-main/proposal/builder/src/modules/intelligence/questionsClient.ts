import { apiFetch } from '../../lib/apiFetch.js'
import type { ProposalIntelligence } from './types.js'
import type { GenerateQuestionsResponse, GeneratedQuestion } from './questionTypes.js'

/**
 * Calls the server-side question-generation route — never Claude directly.
 * No Anthropic API key is ever present in this file (mirrors
 * modules/intelligence/client.ts).
 */
export async function generateQuestions(intelligence: ProposalIntelligence): Promise<GeneratedQuestion[]> {
  const res = await apiFetch('/api/ai/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ intelligence }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Question generation request failed (${res.status})`)
  return (data as GenerateQuestionsResponse).questions
}
