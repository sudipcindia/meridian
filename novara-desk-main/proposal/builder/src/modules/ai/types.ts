import type { ProviderIdentity } from '../branding/identity.js'

/** A generation action the AI Assistant can perform on a section's text. */
export type AIAction = 'generate' | 'improve' | 'shorten' | 'expand'

/** A writing tone the AI Assistant can apply — always within British English. */
export type AITone = 'professional' | 'friendly' | 'corporate' | 'luxury' | 'technical' | 'simple'

/**
 * Everything about this client/proposal the AI should consider. Deliberately
 * a flat, optional bag of strings — some fields (clientName, companyName,
 * websiteLink, serviceType/location) already exist as template variables
 * from the Variable Engine; others (industry, businessType, budget, goals,
 * targetAudience) exist only as AI context and are stored in the same
 * Document.variables map under new keys (see AI_CONTEXT_FIELDS).
 */
export interface AIContext {
  clientName?: string
  clientFirstName?: string
  companyName?: string
  websiteLink?: string
  industry?: string
  businessType?: string
  services?: string
  budget?: string
  goals?: string
  targetAudience?: string
}

export interface AIGenerateRequest {
  /** One of PROPOSAL_SECTIONS' ids (see sections.ts), or 'general'. */
  sectionId: string
  action: AIAction
  tone?: AITone
  /** Required for improve/shorten/expand; ignored for generate. */
  currentText?: string
  context: AIContext
  /** Who this proposal represents as the provider/brand — optional and defaults to 'novara', so omitting it keeps today's behavior exactly. */
  providerIdentity?: ProviderIdentity
}

export interface AIGenerateResponse {
  text: string
}
