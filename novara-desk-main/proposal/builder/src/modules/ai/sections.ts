export interface ProposalSectionDef {
  id: string
  label: string
  /** Fed directly into the prompt — what this section is for and how it should read. */
  guidance: string
}

/**
 * The 12 named section types the AI Assistant can help draft, plus a
 * fallback "General Content" option for any other editable block. These are
 * independent of which literal content-block/page is being edited — the
 * user picks whichever section type best describes what they're writing,
 * so this works regardless of which page/paragraph they clicked.
 */
export const PROPOSAL_SECTIONS: ProposalSectionDef[] = [
  {
    id: 'coverHeading',
    label: 'Cover Page Heading',
    guidance: 'A short, punchy proposal title for the cover page — a few words, not a sentence.',
  },
  {
    id: 'coverParagraph',
    label: 'Cover Page Paragraph',
    guidance: 'A concise two-to-three sentence summary of the problem this proposal solves, for the cover page.',
  },
  {
    id: 'whoWeAre',
    label: 'Who We Are',
    guidance: 'A short introduction to Novara Consult as a growth partner, building trust before the proposal detail.',
  },
  {
    id: 'executiveSummary',
    label: 'Executive Summary',
    guidance: "A high-level summary of the client's situation, the opportunity, and the proposed approach.",
  },
  {
    id: 'seoProposal',
    label: 'SEO Proposal',
    guidance: "A description of the recommended SEO services and how they address the client's specific situation.",
  },
  {
    id: 'ppcProposal',
    label: 'PPC Proposal',
    guidance: "A description of the recommended PPC/paid media services and how they address the client's specific situation.",
  },
  {
    id: 'websiteProposal',
    label: 'Website Proposal',
    guidance: "A description of the recommended website design/build work and how it addresses the client's specific situation.",
  },
  {
    id: 'aiAutomationProposal',
    label: 'AI Automation Proposal',
    guidance: "A description of the recommended AI/automation services and how they address the client's specific situation.",
  },
  {
    id: 'crmProposal',
    label: 'CRM Proposal',
    guidance: "A description of the recommended CRM/operations work and how it addresses the client's specific situation.",
  },
  {
    id: 'investmentDescription',
    label: 'Investment Description',
    guidance: 'A clear, confident description framing the pricing/investment around outcomes, not just cost.',
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    guidance: 'A concise passage covering the specific recommended next steps for this client.',
  },
  {
    id: 'closingMessage',
    label: 'Closing Message',
    guidance: 'A warm, confident closing message inviting the client to move forward.',
  },
  {
    id: 'general',
    label: 'General Content',
    guidance: 'Write clear, professional proposal copy appropriate for the surrounding context.',
  },
]

export function getSectionDef(sectionId: string): ProposalSectionDef {
  return PROPOSAL_SECTIONS.find((s) => s.id === sectionId) ?? PROPOSAL_SECTIONS[PROPOSAL_SECTIONS.length - 1]
}

/**
 * AI-context-only fields — not template placeholders, so the scanner never
 * discovers them. Stored in the same Document.variables map under these
 * keys purely to inform generation (see modules/ai/prompts.ts).
 */
export const AI_CONTEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'industry', label: 'Client Industry' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'services', label: 'Services Selected' },
  { key: 'budget', label: 'Budget' },
  { key: 'goals', label: 'Goals' },
  { key: 'targetAudience', label: 'Target Audience' },
]
