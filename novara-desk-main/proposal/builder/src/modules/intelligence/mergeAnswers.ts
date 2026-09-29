import type { ProposalIntelligence } from './types.js'
import { isArrayTargetField, type IntelligenceTargetField, type QuestionsProgress } from './questionTypes.js'

function setStringField(intelligence: ProposalIntelligence, field: IntelligenceTargetField, value: string): ProposalIntelligence {
  if (field.startsWith('client.')) {
    const key = field.slice('client.'.length) as keyof ProposalIntelligence['client']
    return { ...intelligence, client: { ...intelligence.client, [key]: value } }
  }
  if (field.startsWith('business.')) {
    const key = field.slice('business.'.length) as keyof ProposalIntelligence['business']
    return { ...intelligence, business: { ...intelligence.business, [key]: value } }
  }
  if (field.startsWith('commercial.')) {
    const key = field.slice('commercial.'.length) as keyof ProposalIntelligence['commercial']
    return { ...intelligence, commercial: { ...intelligence.commercial, [key]: value } }
  }
  return { ...intelligence, [field]: value }
}

function setArrayField(intelligence: ProposalIntelligence, field: IntelligenceTargetField, value: string[]): ProposalIntelligence {
  return { ...intelligence, [field]: value }
}

/**
 * Merges answered questions into a Proposal Intelligence object. Only
 * fields that were actually answered are touched — skipped questions, or
 * answers left blank, leave whatever Phase 01 already confirmed
 * completely untouched (never overwrites confirmed data unless the user
 * actually changed it by answering).
 */
export function mergeAnswersIntoIntelligence(intelligence: ProposalIntelligence, progress: QuestionsProgress): ProposalIntelligence {
  let result = intelligence

  for (const question of progress.questions) {
    if (progress.skipped.includes(question.id)) continue
    const answer = progress.answers[question.id]
    if (answer === undefined) continue

    if (isArrayTargetField(question.targetField)) {
      const values = (Array.isArray(answer) ? answer : answer.split('\n')).map((v) => v.trim()).filter(Boolean)
      if (values.length === 0) continue
      result = setArrayField(result, question.targetField, values)
    } else {
      const value = (Array.isArray(answer) ? answer.join(', ') : answer).trim()
      if (!value) continue
      result = setStringField(result, question.targetField, value)
    }
  }

  return result
}
