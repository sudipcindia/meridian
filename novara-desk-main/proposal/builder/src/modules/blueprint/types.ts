import type { ProposalIntelligence, ProposalIntelligenceCommercial } from '../intelligence/index.js'
import type { Page07BlockLayout } from '../salesContent/types.js'
import type { ProviderIdentity } from '../branding/identity.js'

/**
 * Proposal Intelligence Engine — Phase 03: Proposal Blueprint. The
 * structured "brain" of the proposal — every section a future
 * Builder-population phase will need, plus per-page prepared content and
 * resolved variables — but never HTML, never CSS, and never anything
 * written into the Builder itself. Fully independent of
 * modules/analysis/* (an earlier, separate "AI Analysis" tool) and of the
 * Builder's own types — this object is linked to an existing proposal
 * (by id) but never reads or writes the Builder's
 * variables/content-overrides/documents.
 */

export interface ProposalBlueprintClient {
  company: string
  industry: string
  businessSummary: string
}

export interface BlueprintPage01 {
  heading: string
  subHeading: string
  tags: string[]
  introduction: string
}

export interface BlueprintPage08 {
  packages: string[]
  pricingNotes: string
}

export interface BlueprintPage09 {
  timeline: string
  deliverables: string[]
}

export interface BlueprintPage10 {
  company: string
  client: string
}

export interface BlueprintPage11 {
  acceptanceMessage: string
  closingCTA: string
  envelopeMessage: string
}

export interface ProposalBlueprintPages {
  page01: BlueprintPage01
  /** Page 02 — Business Introduction. */
  page02: string
  /** Page 03 — Client Challenges. */
  page03: string
  /** Page 04 — Current Situation. */
  page04: string
  /** Page 05 — Recommended Strategy. */
  page05: string
  /** Page 06 — Implementation Roadmap. */
  page06: string
  /** Page 07 — Why Novara. */
  page07: string
  page08: BlueprintPage08
  page09: BlueprintPage09
  page10: BlueprintPage10
  page11: BlueprintPage11
}

/** One AI-decided additional insight page, inserted after Page 07 (see masterTemplate's DYNAMIC_INSIGHT_PAGE_IDS) — decided by the Content Architect call, never hand-authored. `rationale` is internal-only: it forces the model to genuinely justify the page rather than padding for length, and is never rendered anywhere a client sees. */
export interface DynamicPagePlanEntry {
  layout: Page07BlockLayout
  title: string
  rationale: string
}

/** 0-8 entries (soft cap — see masterTemplate's DYNAMIC_INSIGHT_PAGE_IDS). An empty plan is a valid, often-correct outcome for a client whose intelligence is too sparse to justify extra pages — never padded to hit a target count. */
export interface DynamicPagePlan {
  pages: DynamicPagePlanEntry[]
}

export interface ProposalBlueprintVariables {
  clientName: string
  clientFirstName: string
  clientLastName: string
  companyName: string
  proposalName: string
  preparedBy: string
  proposalType: string
  industry: string
  location: string
  website: string
  services: string[]
  /** Carried through from BlueprintProposalContext so downstream routes that only receive the Blueprint (not a separate proposal context) — see api/ai/generate-content.ts's manual-flow handler — can still thread it into their prompts. Optional and defaults to 'novara' everywhere it's read. */
  providerIdentity?: ProviderIdentity
}

export interface ProposalBlueprint {
  client: ProposalBlueprintClient
  currentSituation: string
  painPoints: string[]
  businessGoals: string[]
  challenges: string[]
  opportunities: string[]
  competitors: string[]
  recommendedServices: string[]
  recommendedStrategy: string
  deliverables: string[]
  timeline: string
  kpis: string[]
  pricingStrategy: string
  investmentRecommendation: string
  roiOpportunities: string[]
  closingMessage: string
  callToAction: string
  proposalTone: string
  /** Verbatim passthrough from ProposalIntelligence — previously dropped entirely during Blueprint synthesis, which silently starved the manual (non-auto-flow) content-generation path of context the auto-flow always had. */
  urgency: string
  decisionMakers: string[]
  missingInformation: string[]
  objections: string[]
  budget: string
  commercial: ProposalIntelligenceCommercial
  pages: ProposalBlueprintPages
  variables: ProposalBlueprintVariables
  dynamicPagePlan: DynamicPagePlan
}

export function emptyProposalBlueprint(): ProposalBlueprint {
  return {
    client: { company: '', industry: '', businessSummary: '' },
    currentSituation: '',
    painPoints: [],
    businessGoals: [],
    challenges: [],
    opportunities: [],
    competitors: [],
    recommendedServices: [],
    recommendedStrategy: '',
    deliverables: [],
    timeline: '',
    kpis: [],
    pricingStrategy: '',
    investmentRecommendation: '',
    roiOpportunities: [],
    closingMessage: '',
    callToAction: '',
    proposalTone: '',
    urgency: '',
    decisionMakers: [],
    missingInformation: [],
    objections: [],
    budget: '',
    commercial: {
      packageDetails: '',
      deposit: '',
      paymentTerms: '',
      contractDuration: '',
      recommendedPackage: '',
      optionalServices: '',
      guarantees: '',
    },
    pages: {
      page01: { heading: '', subHeading: '', tags: [], introduction: '' },
      page02: '',
      page03: '',
      page04: '',
      page05: '',
      page06: '',
      page07: '',
      page08: { packages: [], pricingNotes: '' },
      page09: { timeline: '', deliverables: [] },
      page10: { company: '', client: '' },
      page11: { acceptanceMessage: '', closingCTA: '', envelopeMessage: '' },
    },
    variables: {
      clientName: '',
      clientFirstName: '',
      clientLastName: '',
      companyName: '',
      proposalName: '',
      preparedBy: '',
      proposalType: '',
      industry: '',
      location: '',
      website: '',
      services: [],
    },
    dynamicPagePlan: { pages: [] },
  }
}

/** The subset of Proposal metadata needed to resolve deterministic Blueprint variables — never the full Proposal type, to keep this module decoupled from the Builder's own types. */
export interface BlueprintProposalContext {
  clientName: string
  clientFirstName: string
  companyName: string
  proposalName: string
  proposalType: string
  preparedBy: string
  /** Who this proposal represents as the provider/brand — optional and defaults to 'novara' everywhere it's read, so omitting it keeps today's behavior exactly. */
  providerIdentity?: ProviderIdentity
}

export interface GenerateBlueprintRequest {
  proposal: BlueprintProposalContext
  intelligence: ProposalIntelligence
}

export interface GenerateBlueprintResponse {
  blueprint: ProposalBlueprint
}
