/**
 * Which entity a proposal represents as the provider/brand — the default
 * "novara" identity (Novara Consult) versus "upwork" (Jayson Kandiah,
 * presented personally rather than as a company — the Upwork use case).
 * Isomorphic: imported from both browser modules and Vercel serverless
 * functions, so it must stay dependency-free.
 *
 * Every helper here defaults its `identity` parameter to 'novara', so any
 * existing call site that doesn't pass one keeps behaving exactly as
 * before this feature existed.
 */
export type ProviderIdentity = 'novara' | 'upwork'

export const PROVIDER_IDENTITY_OPTIONS: ProviderIdentity[] = ['novara', 'upwork']

export const PROVIDER_IDENTITY_LABELS: Record<ProviderIdentity, string> = {
  novara: 'Novara Proposal',
  upwork: 'Upwork Proposal',
}

const PROVIDER_NAMES: Record<ProviderIdentity, string> = {
  novara: 'Novara Consult',
  upwork: 'Jayson Kandiah',
}

/** The full provider/brand name — "Novara Consult" or "Jayson Kandiah". */
export function getProviderName(identity: ProviderIdentity = 'novara'): string {
  return PROVIDER_NAMES[identity]
}

/**
 * One extra system-prompt instruction line, appended (not substituted) after
 * each file's own existing persona sentence — this is what stops AI-generated
 * copy from reading as "our team at Jayson Kandiah" (a plain find/replace on
 * the brand name alone would produce exactly that mismatch, since the
 * existing persona sentences are all written in company "we/our" voice).
 * Empty for novara — appending an empty string changes nothing.
 */
export function getVoiceGuidance(identity: ProviderIdentity = 'novara'): string {
  if (identity !== 'upwork') return ''
  return 'This proposal is presented as coming from Jayson Kandiah personally — an independent consultant on Upwork, not a company. Write in first person ("I", "my"), never "we", "our team", or "Novara".'
}
