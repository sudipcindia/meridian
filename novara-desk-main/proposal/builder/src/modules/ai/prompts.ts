import { getSectionDef } from './sections.js'
import type { AIGenerateRequest, AITone } from './types.js'
import { getProviderName, getVoiceGuidance, type ProviderIdentity } from '../branding/identity.js'

/**
 * Reusable prompt builders — the ONE place prompt logic lives. Both the
 * generate flow and every transform (improve/shorten/expand/tone change)
 * go through these two functions; no proposal section implements its own
 * prompt-building logic.
 */

const TONE_INSTRUCTIONS: Record<AITone, string> = {
  professional: 'Professional and confident.',
  friendly: 'Warm and friendly, while still professional.',
  corporate: 'Formal, corporate business language.',
  luxury: 'Premium, high-end, aspirational language.',
  technical: 'Precise and technical, comfortable with industry terminology.',
  simple: 'Simple English — short sentences, plain everyday words, no jargon.',
}

export function buildSystemPrompt(identity: ProviderIdentity = 'novara'): string {
  const providerName = getProviderName(identity)
  const lines = [
    `You are an assistant helping ${providerName}${identity === 'novara' ? ', a UK growth consultancy,' : ','} draft content for client proposals.`,
    'Always write in British English (colour, organise, favour, and similar UK spellings).',
    'Write in a professional, consultative tone — like a senior consultant advising a client directly, never like a marketing brochure. Avoid clichés, filler, hype, and generic marketing language.',
    'Apply sales psychology grounded in substance, never gimmicks: lead with the client\'s pain point or problem before the solution (pain-first copywriting), and frame every point in terms of the outcome it produces for the client, not just the feature or activity itself (outcome-first messaging).',
    'Produce ONLY plain content text — the words themselves, nothing else. Never output HTML tags, CSS, Markdown syntax (no #, *, -, backticks, or code fences), or JavaScript/code of any kind, and never wrap the answer in a code block.',
    'Return only the requested content itself — no preamble, no explanation, no headings you were not asked for, no surrounding quotation marks.',
  ]
  const voiceGuidance = getVoiceGuidance(identity)
  if (voiceGuidance) lines.push(voiceGuidance)
  return lines.join('\n\n')
}

export function buildUserPrompt(request: AIGenerateRequest): string {
  const section = getSectionDef(request.sectionId)

  const contextLines = Object.entries(request.context)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  const lines: string[] = [`Section: ${section.label}`, section.guidance]

  if (contextLines) lines.push(`Client context:\n${contextLines}`)
  if (request.tone) lines.push(`Tone: ${TONE_INSTRUCTIONS[request.tone]}`)

  switch (request.action) {
    case 'generate':
      lines.push('Write this section from scratch based on the context above.')
      break
    case 'improve':
      lines.push(`Improve the following existing text while keeping its intent:\n"""\n${request.currentText ?? ''}\n"""`)
      break
    case 'shorten':
      lines.push(`Make the following text noticeably shorter while keeping its key meaning:\n"""\n${request.currentText ?? ''}\n"""`)
      break
    case 'expand':
      lines.push(`Expand the following text with more relevant detail:\n"""\n${request.currentText ?? ''}\n"""`)
      break
  }

  return lines.filter(Boolean).join('\n\n')
}
