import { getProposal, updateProposal, type ProposalUpdateInput } from '../../lib/proposals.js'
import { getDocumentByProposalId, setDynamicInsightPages } from '../../lib/documents.js'
import { getBlueprint, saveBlueprint } from '../../lib/blueprints.js'
import { getContent, saveContent } from '../../lib/salesContent.js'
import { applyPopulation } from '../../lib/populateBuilder.js'
import { emptyProposalBlueprint, type ProposalBlueprint, type DynamicPagePlan, type DynamicPagePlanEntry } from '../blueprint/index.js'
import { emptyProposalContent, generateContentForPage, planDynamicPages, type ProposalContent, type ProposalContentPages } from '../salesContent/index.js'
import {
  buildPopulationSections,
  buildAutoGeneratePageOrder,
  getAutoGeneratePageLabel,
  type AutoGeneratePageId,
  type ConflictResolution,
} from '../blueprintPopulate/index.js'
import { DYNAMIC_INSIGHT_PAGE_IDS, type DynamicInsightPageId } from '../../masterTemplate/index.js'
import type { Proposal } from '../../types/proposal.js'
import type { ProposalIntelligence } from './types.js'

/** The exact placeholder-name prefix CreateProposalModal.tsx seeds a Meeting-Transcript proposal with — this is the one signal that a real Proposal Name hasn't been set yet (every other field can just be checked for blank). */
const PLACEHOLDER_NAME_PREFIX = 'New Proposal — '

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/**
 * Fills in the Proposal row's metadata from AI-extracted Intelligence —
 * mirrors modules/analysis/toProposalSeed.ts's derivation (clientFirstName
 * from clientName, proposalName as "<company or client> Proposal"). Only
 * ever fills a field that's still genuinely blank (or, for proposalName,
 * still the placeholder seeded at creation) — never overwrites a value the
 * rep already typed or corrected on the Intelligence review screen.
 */
function deriveProposalUpdate(proposal: Proposal, intelligence: ProposalIntelligence): ProposalUpdateInput {
  const patch: ProposalUpdateInput = {}
  const { client } = intelligence

  const clientName = proposal.clientName.trim() || client.fullName.trim()
  if (!proposal.clientName.trim() && clientName) patch.clientName = clientName

  const clientFirstName = proposal.clientFirstName.trim() || client.firstName.trim() || firstNameOf(clientName)
  if (!proposal.clientFirstName.trim() && clientFirstName) patch.clientFirstName = clientFirstName

  const companyName = proposal.companyName.trim() || client.company.trim()
  if (!proposal.companyName.trim() && companyName) patch.companyName = companyName

  const clientEmail = proposal.clientEmail.trim() || client.email.trim()
  if (!proposal.clientEmail.trim() && clientEmail) patch.clientEmail = clientEmail

  if (proposal.proposalName.startsWith(PLACEHOLDER_NAME_PREFIX)) {
    const derived = `${companyName || clientName} Proposal`.trim()
    if (derived !== 'Proposal') patch.proposalName = derived
  }

  return patch
}

/**
 * Fills the handful of Blueprint fields that need zero AI generation —
 * `variables` and `page10` are a straight copy from Intelligence/Proposal
 * metadata. Mirrors api/ai/generate-blueprint.ts's `buildBlueprint()`
 * variables/page10 derivation exactly — a small, deliberate duplication
 * rather than touching that file, which is the manual Blueprint page's own
 * route and is left untouched by this flow.
 */
function applyDeterministicFields(blueprint: ProposalBlueprint, intelligence: ProposalIntelligence, proposal: Proposal): ProposalBlueprint {
  const resolvedClientName = intelligence.client.fullName || proposal.clientName
  const resolvedCompany = intelligence.client.company || proposal.companyName
  return {
    ...blueprint,
    businessGoals: intelligence.goals,
    variables: {
      clientName: resolvedClientName,
      clientFirstName: intelligence.client.firstName || proposal.clientFirstName,
      clientLastName: intelligence.client.lastName,
      companyName: resolvedCompany,
      proposalName: proposal.proposalName,
      preparedBy: proposal.preparedBy,
      proposalType: proposal.proposalType,
      industry: intelligence.client.industry,
      location: intelligence.client.location,
      website: intelligence.client.website,
      services: intelligence.recommendedServices,
      providerIdentity: proposal.providerIdentity,
    },
    pages: {
      ...blueprint.pages,
      // page10.company/page10.client map onto the frozen template's RIGHT
      // (client-side) signature column only — the left column is Novara's
      // own name, hardcoded directly in ProposalPage10.tsx, never dynamic.
      // Previously this wrote { company: 'Novara Consult', client:
      // resolvedCompany || resolvedClientName }, which put Novara's own name
      // on the client's side of the signature and buried the client's own
      // contact name behind their company name.
      page10: { company: resolvedCompany, client: resolvedClientName },
    },
  }
}

/** Whether this page's specific saved fields are already non-empty — the resumability signal a Retry uses to skip already-completed pages instead of restarting from Cover. */
function isPageComplete(pageId: AutoGeneratePageId, content: ProposalContent, blueprint: ProposalBlueprint): boolean {
  if ((DYNAMIC_INSIGHT_PAGE_IDS as readonly string[]).includes(pageId)) {
    return Boolean(content.pages[pageId as DynamicInsightPageId]?.title.trim())
  }
  switch (pageId) {
    case 'cover':
      return Boolean(content.pages.page01.title.trim() && content.pages.page01.introduction.trim() && blueprint.pages.page01.subHeading.trim())
    case 'page02':
      return Boolean(
        content.pages.page02.introParagraph.trim() && content.pages.page02.companyUnderstanding.trim() && content.pages.page02.welcomeMessage.trim()
      )
    case 'insightsBusiness':
      return Boolean(content.pages.insightsBusiness.businessOverview.trim())
    case 'insightsGrowth':
      return Boolean(
        content.pages.insightsGrowth.marketIndustryPosition.trim() &&
          content.pages.insightsGrowth.futureGrowthPotential.trim() &&
          content.pages.insightsGrowth.growthOpportunities.length > 0
      )
    case 'page07':
      return Boolean(
        content.pages.page07.description.trim() &&
          content.pages.page07.situation.trim() &&
          content.pages.page07.opportunity.trim() &&
          content.pages.page07.keywords.length > 0
      )
    case 'page08':
      // Requires a real ≥2-card pricing set, not just the explanation
      // paragraph — a Retry after a partial/invalid card response must
      // regenerate the whole page, since the frozen template's combination
      // box structurally needs two real packages to combine.
      return Boolean(content.pages.page08.investmentExplanation.trim()) && content.pages.page08.cards.length >= 2
    case 'page11':
      return Boolean(content.pages.page11.envelopeMessage.trim())
    default:
      // page05 is the only remaining case ever reached here (every other
      // base id has its own case above, dynamic ids already returned
      // above) — a plain string field, cast needed only because
      // AutoGeneratePageId is now widened to include dynamic ids.
      return Boolean(content.pages[pageId as 'page05'].trim())
  }
}

function mergePageIntoContent(content: ProposalContent, partial: Partial<ProposalContentPages>): ProposalContent {
  return { ...content, pages: { ...content.pages, ...partial } }
}

export type PageGenerationStatus = 'pending' | 'generating' | 'done' | 'failed'
/** `label` is always the real display label — the static one for a base page, or the Content Architect's decided title for a dynamicInsight0N page — so callers never need their own lookup. */
export type OnPageProgress = (pageId: AutoGeneratePageId, status: PageGenerationStatus, label: string) => void

/** Maps the Content Architect's ordered plan entries onto their reserved dynamicInsight01.."08" slots, 1:1 by position — the same mapping setDynamicInsightPages/buildAutoGeneratePageOrder use for the page-order splice. */
function mapDynamicPagePlanToSlots(plan: DynamicPagePlan): Partial<Record<DynamicInsightPageId, DynamicPagePlanEntry>> {
  const result: Partial<Record<DynamicInsightPageId, DynamicPagePlanEntry>> = {}
  plan.pages.forEach((entry, i) => {
    const pageId = DYNAMIC_INSIGHT_PAGE_IDS[i]
    if (pageId) result[pageId] = entry
  })
  return result
}

/**
 * The Meeting Transcript auto-flow's orchestrator: once Smart Questions has
 * closed every essential gap, this generates the proposal ONE PAGE AT A
 * TIME — each page is a small, independent Claude call, saved immediately
 * (via the existing Blueprint/Content tables' upsert-on-proposal_id save
 * functions) and applied to the real Builder document immediately (reusing
 * `buildPopulationSections`/`applyPopulation` exactly as the manual
 * Population page does, scoped to just that one page's section) before
 * moving to the next page. Resumable: re-invoking this (e.g. via the UI's
 * Retry after a failure) re-checks what's already saved and skips any page
 * that's already complete, continuing from the first incomplete one — it
 * never restarts the whole proposal or regenerates a page that succeeded.
 * On any page's failure, this throws immediately without attempting any
 * later page.
 */
export async function autoGenerateProposal(proposalId: string, intelligence: ProposalIntelligence, onProgress: OnPageProgress): Promise<void> {
  const proposal = await getProposal(proposalId)
  if (!proposal) throw new Error('Proposal not found')

  const patch = deriveProposalUpdate(proposal, intelligence)
  const updated = Object.keys(patch).length > 0 ? await updateProposal(proposalId, patch) : proposal

  const [blueprintRecord, contentRecord, doc0] = await Promise.all([
    getBlueprint(proposalId),
    getContent(proposalId),
    getDocumentByProposalId(proposalId),
  ])
  if (!doc0) throw new Error('Proposal document not found')

  let blueprint = blueprintRecord?.blueprint ?? emptyProposalBlueprint()
  let content = contentRecord?.content ?? emptyProposalContent()
  let document = doc0

  const proposalCtx = {
    clientName: updated.clientName,
    clientFirstName: updated.clientFirstName,
    companyName: updated.companyName,
    proposalName: updated.proposalName,
    proposalType: updated.proposalType,
    preparedBy: updated.preparedBy,
    providerIdentity: updated.providerIdentity,
  }

  // Deterministic setup (variables + Page 10) — no AI call, not a visible progress row.
  blueprint = applyDeterministicFields(blueprint, intelligence, updated)

  // Content Architect: decides how many (0-8) dynamic insight pages this
  // client's facts justify, and what type — see blueprint/types.ts's
  // DynamicPagePlan. Resumability: only decided ONCE per proposal, on the
  // very first invocation (Cover not yet complete) — a Retry after a
  // later page's failure reuses the already-saved plan rather than
  // re-deciding, since a different decision on retry would desync from
  // whatever dynamic pages/content were already inserted/generated on the
  // first attempt. planDynamicPages itself never throws (see its own doc
  // comment) — a decision failure always degrades to "no extra pages."
  const isFirstRun = !isPageComplete('cover', content, blueprint)
  // The `?? { pages: [] }` fallback matters for a proposal whose
  // auto-flow was started before this feature shipped and is only now
  // being retried — its saved blueprint predates the dynamicPagePlan
  // field entirely, so it would otherwise be `undefined` here rather than
  // a real (even if empty) plan.
  const dynamicPagePlan: DynamicPagePlan = isFirstRun ? await planDynamicPages(intelligence, proposalCtx) : (blueprint.dynamicPagePlan ?? { pages: [] })
  blueprint = { ...blueprint, dynamicPagePlan }
  await saveBlueprint(proposalId, blueprint)

  const dynamicPageIds = DYNAMIC_INSIGHT_PAGE_IDS.slice(0, dynamicPagePlan.pages.length)
  const dynamicPageSlots = mapDynamicPagePlanToSlots(dynamicPagePlan)
  const dynamicPageTitles = Object.fromEntries(Object.entries(dynamicPageSlots).map(([id, entry]) => [id, entry!.title])) as Partial<
    Record<DynamicInsightPageId, string>
  >

  // Splice the decided dynamic pages into the document's own page order —
  // idempotent: only writes (and only bumps documentVersion) when the set
  // isn't already exactly what's there, so a Retry can never double-insert
  // or double-bump the version for the same decision.
  const pagesAlreadyMatch =
    dynamicPageIds.length === document.pages.filter((id) => (DYNAMIC_INSIGHT_PAGE_IDS as readonly string[]).includes(id)).length &&
    dynamicPageIds.every((id) => document.pages.includes(id))
  if (!pagesAlreadyMatch) {
    document = await setDynamicInsightPages(document, dynamicPageIds)
  }

  const deterministicSections = buildPopulationSections(blueprint, content, document, proposalCtx).filter(
    (s) => s.id === 'variables' || s.id === 'page10'
  )
  if (deterministicSections.length > 0) {
    const resolutions = Object.fromEntries(deterministicSections.map((s) => [s.id, 'replace' as ConflictResolution]))
    document = await applyPopulation(document, deterministicSections, resolutions)
  }

  const pageOrder = buildAutoGeneratePageOrder(dynamicPagePlan.pages.length)

  // Cover through Page 11 (including 0-N dynamic pages), one at a time — resumable, stop on first failure.
  for (const pageId of pageOrder) {
    const label = getAutoGeneratePageLabel(pageId, dynamicPageTitles)
    if (isPageComplete(pageId, content, blueprint)) {
      onProgress(pageId, 'done', label)
      continue
    }

    onProgress(pageId, 'generating', label)
    try {
      const dynamicSlot = dynamicPageSlots[pageId as DynamicInsightPageId]
      // page07 only — every layout already claimed by a dynamic page, so
      // page07's own independent layout choice can't collide with one of
      // them (see buildContentSystemPromptForPage's own doc comment).
      const excludeLayouts = pageId === 'page07' ? dynamicPagePlan.pages.map((p) => p.layout) : undefined
      const result = await generateContentForPage(
        pageId,
        intelligence,
        proposalCtx,
        dynamicSlot ? { layout: dynamicSlot.layout, title: dynamicSlot.title } : undefined,
        excludeLayouts
      )
      content = mergePageIntoContent(content, result.content)
      await saveContent(proposalId, content)

      if (pageId === 'cover' && result.subHeading) {
        blueprint = { ...blueprint, pages: { ...blueprint.pages, page01: { ...blueprint.pages.page01, subHeading: result.subHeading } } }
        await saveBlueprint(proposalId, blueprint)
      }

      const sections = buildPopulationSections(blueprint, content, document, proposalCtx).filter((s) => s.id === pageId)
      if (sections.length > 0) {
        const resolutions = Object.fromEntries(sections.map((s) => [s.id, 'replace' as ConflictResolution]))
        document = await applyPopulation(document, sections, resolutions)
      }
      onProgress(pageId, 'done', label)
    } catch (err) {
      onProgress(pageId, 'failed', label)
      console.error(`autoGenerateProposal: failed on ${label}:`, err instanceof Error ? err.message : err)
      throw err
    }
  }
}
