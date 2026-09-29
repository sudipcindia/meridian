/**
 * Blueprint -> Builder field mapping. Deliberately conservative: only maps
 * onto content-override/variable keys that already exist in the Builder
 * today (reusing the exact same entry-generating functions the real
 * Editor calls, so template defaults can never drift out of sync with
 * this module) and — critically — SKIPS any Blueprint field with no safe
 * existing target rather than inventing one (see getNotAvailableItems).
 * This keeps Phase 04 to "populate only existing editable fields," with
 * zero template/layout changes of any kind.
 */

import type { ProposalDocument } from '../../types/document.js'
import type { ProposalBlueprint } from '../blueprint/index.js'
import type { ProposalContent } from '../salesContent/index.js'
import { DYNAMIC_INSIGHT_PAGE_IDS } from '../../masterTemplate/index.js'
import {
  getContentBlocksForPage,
  getCoverFieldEntries,
  getPage02FieldEntries,
  getInsightsBusinessFieldEntries,
  getInsightsGrowthFieldEntries,
  getPage07FieldEntries,
  getPage08FieldEntries,
  getPage10FieldEntries,
  getPage11FieldEntries,
  type ContentBlockManifestEntry,
} from '../variables/index.js'
import { deriveComboBoxFields, derivePackagesDescription } from '../variables/page08Fields.js'
import { serializeCollection } from '../variables/collections.js'
import type { NotAvailableItem, PopulationField, PopulationSection } from './types.js'

export interface PopulationProposalContext {
  clientName: string
  companyName: string
  preparedBy: string
}

function entryText(entries: ContentBlockManifestEntry[], key: string): string {
  return entries.find((e) => e.key === key)?.originalText ?? ''
}

/** Prefers the Sales Content Engine's (Phase 05) copy for a field, falling back to the Blueprint's (Phase 03) own page content when no content has been generated/saved yet — so Population keeps working exactly as before even if this phase's step is skipped. */
function pick(contentValue: string | undefined, blueprintValue: string): string {
  const trimmed = contentValue?.trim()
  return trimmed ? trimmed : blueprintValue
}

function pickArray(contentValue: string[] | undefined, blueprintValue: string[]): string[] {
  return contentValue && contentValue.length > 0 ? contentValue : blueprintValue
}

function overrideField(key: string, label: string, suggestedValue: string, document: ProposalDocument, originalText: string): PopulationField {
  const rawOverride = document.contentOverrides[key]
  return {
    key,
    targetType: 'override',
    label,
    currentValue: rawOverride ?? originalText,
    suggestedValue: suggestedValue.trim(),
    isCustomized: rawOverride !== undefined && rawOverride !== originalText,
  }
}

function variableField(key: string, label: string, suggestedValue: string, document: ProposalDocument): PopulationField {
  const rawValue = document.variables[key]
  return {
    key,
    targetType: 'variable',
    label,
    currentValue: rawValue ?? '',
    suggestedValue: suggestedValue.trim(),
    isCustomized: rawValue !== undefined && rawValue !== '',
  }
}

function withContent(fields: PopulationField[]): PopulationField[] {
  return fields.filter((f) => f.suggestedValue !== '')
}

export function buildPopulationSections(
  blueprint: ProposalBlueprint,
  content: ProposalContent | null,
  document: ProposalDocument,
  proposal: PopulationProposalContext
): PopulationSection[] {
  const coverEntries = getCoverFieldEntries({ clientName: proposal.clientName, preparedBy: proposal.preparedBy })
  const page02Entries = getPage02FieldEntries()
  const insightsBusinessEntries = getInsightsBusinessFieldEntries()
  const insightsGrowthEntries = getInsightsGrowthFieldEntries()
  const page05Entries = getContentBlocksForPage('page05')
  const page07Entries = getPage07FieldEntries()
  const page08Entries = getPage08FieldEntries()
  const page10Entries = getPage10FieldEntries({ companyName: proposal.companyName, clientName: proposal.clientName })
  const page11Entries = getPage11FieldEntries()

  const title = pick(content?.pages.page01.title, blueprint.pages.page01.heading)
  const introduction = pick(content?.pages.page01.introduction, blueprint.pages.page01.introduction)
  const tags = pickArray(content?.pages.page01.tags, blueprint.pages.page01.tags)
  const tagKeys = ['cover.tag0', 'cover.tag1', 'cover.tag2', 'cover.tag3', 'cover.tag4']
  const tagFields = tagKeys
    .map((key, i) => (tags[i] ? overrideField(key, `Floating Tag ${i + 1}`, tags[i], document, entryText(coverEntries, key)) : null))
    .filter((f): f is PopulationField => f !== null)

  const page05Text = pick(content?.pages.page05, blueprint.pages.page05)
  // No Blueprint fallback for insightsBusiness/insightsGrowth — this is new
  // structured Business Intelligence content this engine generates directly
  // (see the module doc for the "no Blueprint fallback" pattern already
  // used by page08.cards). These are premium pages inserted after Page 07 —
  // never the frozen Page 03/04.
  const insightsBusinessOverview = content?.pages.insightsBusiness.businessOverview ?? ''
  const insightsBusinessCurrentPosition = content?.pages.insightsBusiness.currentPosition ?? []
  const insightsBusinessSwot = content?.pages.insightsBusiness.swot ?? { strengths: [], weaknesses: [], risks: [] }
  const insightsGrowthOpportunities = content?.pages.insightsGrowth.growthOpportunities ?? []
  const insightsGrowthMarketIndustryPosition = content?.pages.insightsGrowth.marketIndustryPosition ?? ''
  const insightsGrowthFutureGrowthPotential = content?.pages.insightsGrowth.futureGrowthPotential ?? ''
  const page07Description = pick(content?.pages.page07.description, blueprint.pages.page07)
  const investmentExplanation = pick(content?.pages.page08.investmentExplanation, blueprint.pages.page08.pricingNotes)
  const envelopeMessage = pick(content?.pages.page11.envelopeMessage, blueprint.pages.page11.envelopeMessage)

  // No Blueprint fallback here — pricing cards are new structured content
  // this engine generates directly, the Blueprint never carried this data
  // (see getNotAvailableItems' former "Page 08 — Packages" entry).
  // 0-8 AI-decided pages (see masterTemplate/index.ts's
  // DYNAMIC_INSIGHT_PAGE_IDS), inserted after insightsGrowth/before page08 —
  // one section per slot that actually has content, stored as a single JSON
  // blob override (mirrors page07.enrichment/insightsBusiness.swot's own
  // "structured content as one override key" pattern), never split into
  // per-field overrides since the whole { title, kicker, blocks } object is
  // always read/written together (see resolveDynamicInsightPages).
  const dynamicInsightSections: PopulationSection[] = DYNAMIC_INSIGHT_PAGE_IDS.map((pageId): PopulationSection | null => {
    const page = content?.pages[pageId]
    if (!page || !page.title.trim()) return null
    return {
      id: pageId,
      label: page.title,
      fields: withContent([
        overrideField(pageId, page.title, JSON.stringify({ title: page.title, kicker: page.kicker, blocks: page.blocks }), document, JSON.stringify(null)),
      ]),
    }
  }).filter((s): s is PopulationSection => s !== null)

  const page08Cards = content?.pages.page08.cards ?? []
  const combo = deriveComboBoxFields(page08Cards, content?.pages.page08.recommendedCardId ?? '', content?.pages.page08.complementaryCardId ?? '')
  const page08Blocks = getContentBlocksForPage('page08')
  const page07Blocks = getContentBlocksForPage('page07')
  const page07Keywords = content?.pages.page07.keywords ?? []
  const page07Enrichment = content?.pages.page07.enrichment

  const sections: PopulationSection[] = [
    {
      id: 'variables',
      label: 'Variables (Placeholders)',
      fields: withContent([
        variableField('clientName', 'Client Name', blueprint.variables.clientName, document),
        variableField('clientFirstName', 'Client First Name', blueprint.variables.clientFirstName, document),
        variableField('companyName', 'Company Name', blueprint.variables.companyName, document),
        variableField('businessName', 'Business Name', blueprint.variables.companyName, document),
        variableField('websiteLink', 'Website', blueprint.variables.website, document),
        variableField('location', 'Location', blueprint.variables.location, document),
        variableField('serviceType', 'Primary Service', blueprint.variables.services[0] ?? '', document),
        variableField('services', 'Services', blueprint.variables.services.join(', '), document),
        variableField('industry', 'Industry', blueprint.variables.industry, document),
        variableField('goals', 'Goals', blueprint.businessGoals.join(', '), document),
      ]),
    },
    {
      id: 'cover',
      label: 'Cover Page',
      fields: withContent([
        overrideField('cover.title', 'Proposal Title', title, document, entryText(coverEntries, 'cover.title')),
        overrideField('cover.heading', 'Sub Heading', blueprint.pages.page01.subHeading, document, entryText(coverEntries, 'cover.heading')),
        overrideField('cover.paragraph', 'Intro Paragraph', introduction, document, entryText(coverEntries, 'cover.paragraph')),
        ...tagFields,
        overrideField('cover.clientName', 'Client Name (Cover)', blueprint.variables.clientName, document, entryText(coverEntries, 'cover.clientName')),
        overrideField('cover.preparedBy', 'Prepared By', blueprint.variables.preparedBy, document, entryText(coverEntries, 'cover.preparedBy')),
      ]),
    },
    {
      id: 'page02',
      label: 'Page 02 — Business Introduction',
      fields: withContent([
        overrideField(
          'page02.introParagraph',
          'Intro Paragraph',
          pick(content?.pages.page02.introParagraph, blueprint.pages.page02),
          document,
          entryText(page02Entries, 'page02.introParagraph')
        ),
        overrideField(
          'page02.companyDescription',
          'Company Understanding',
          content?.pages.page02.companyUnderstanding ?? '',
          document,
          entryText(page02Entries, 'page02.companyDescription')
        ),
        overrideField(
          'page02.welcomeHeading',
          'Welcome Message',
          content?.pages.page02.welcomeMessage ?? '',
          document,
          entryText(page02Entries, 'page02.welcomeHeading')
        ),
      ]),
    },
    {
      id: 'page05',
      label: 'Page 05 — Recommended Strategy',
      fields: withContent([overrideField('page05.block1', 'Strategy', page05Text, document, entryText(page05Entries, 'page05.block1'))]),
    },
    {
      id: 'page07',
      label: 'Page 07 — Why Novara',
      fields: withContent([
        overrideField('page07.description', 'Why Novara', page07Description, document, entryText(page07Entries, 'page07.description')),
        overrideField('page07.heading', 'Heading', content?.pages.page07.heading ?? '', document, entryText(page07Entries, 'page07.heading')),
        // Replaces the static "SEO & Website Growth Proposal" kicker/label —
        // adaptive so it reflects whatever strategy was actually recommended.
        overrideField('page07.block1', 'Kicker', content?.pages.page07.kicker ?? '', document, entryText(page07Blocks, 'page07.block1')),
        overrideField('page07.block3', 'Business Situation', content?.pages.page07.situation ?? '', document, entryText(page07Blocks, 'page07.block3')),
        overrideField('page07.block4', 'Opportunity', content?.pages.page07.opportunity ?? '', document, entryText(page07Blocks, 'page07.block4')),
        overrideField('page07.block5', 'Demand Intro', content?.pages.page07.demandIntro ?? '', document, entryText(page07Blocks, 'page07.block5')),
        overrideField('page07.funnelStep0', 'Funnel Step 1', content?.pages.page07.funnelSteps[0] ?? '', document, entryText(page07Entries, 'page07.funnelStep0')),
        overrideField('page07.funnelStep1', 'Funnel Step 2', content?.pages.page07.funnelSteps[1] ?? '', document, entryText(page07Entries, 'page07.funnelStep1')),
        overrideField('page07.funnelStep2', 'Funnel Step 3', content?.pages.page07.funnelSteps[2] ?? '', document, entryText(page07Entries, 'page07.funnelStep2')),
        // Only written when real generated keywords exist — an empty array
        // would otherwise serialize to the non-empty string "[]" and
        // incorrectly clobber the Editor's own DEFAULT_PAGE07_KEYWORDS fallback.
        ...(page07Keywords.length > 0
          ? [overrideField('page07.keywords', 'Demand Keywords', serializeCollection(page07Keywords), document, serializeCollection([]))]
          : []),
        // Only written when the AI actually selected at least one visual
        // block — an empty blocks array means "no extra block," so writing
        // it would clobber the Editor's own default with an empty override.
        ...(page07Enrichment && page07Enrichment.blocks.length > 0
          ? [overrideField('page07.enrichment', 'Visual Blocks', JSON.stringify(page07Enrichment), document, JSON.stringify(null))]
          : []),
      ]),
    },
    {
      id: 'insightsBusiness',
      label: 'Business Insights — Where You Stand Today',
      fields: withContent([
        overrideField(
          'insightsBusiness.businessOverview',
          'Business Overview',
          insightsBusinessOverview,
          document,
          entryText(insightsBusinessEntries, 'insightsBusiness.businessOverview')
        ),
        // Only written when real content exists — an empty array/object
        // would otherwise serialize to a non-empty-looking string and
        // incorrectly clobber the Editor's own empty-state default. >=3 not
        // >=2 — the radar chart this feeds needs at least 3 axes to render.
        ...(insightsBusinessCurrentPosition.length >= 3
          ? [overrideField('insightsBusiness.currentPosition', 'Current Position & Digital Maturity', JSON.stringify(insightsBusinessCurrentPosition), document, JSON.stringify([]))]
          : []),
        ...(insightsBusinessSwot.strengths.length + insightsBusinessSwot.weaknesses.length + insightsBusinessSwot.risks.length > 0
          ? [overrideField('insightsBusiness.swot', 'Strengths, Weaknesses & Risks', JSON.stringify(insightsBusinessSwot), document, JSON.stringify({ strengths: [], weaknesses: [], risks: [] }))]
          : []),
      ]),
    },
    {
      id: 'insightsGrowth',
      label: 'Growth Insights — The Opportunity Ahead',
      fields: withContent([
        ...(insightsGrowthOpportunities.length > 0
          ? [overrideField('insightsGrowth.growthOpportunities', 'Growth & Missed Opportunities', JSON.stringify(insightsGrowthOpportunities), document, JSON.stringify([]))]
          : []),
        overrideField(
          'insightsGrowth.marketIndustryPosition',
          'Market, Industry & Competitive Position',
          insightsGrowthMarketIndustryPosition,
          document,
          entryText(insightsGrowthEntries, 'insightsGrowth.marketIndustryPosition')
        ),
        overrideField(
          'insightsGrowth.futureGrowthPotential',
          'Future Growth Potential',
          insightsGrowthFutureGrowthPotential,
          document,
          entryText(insightsGrowthEntries, 'insightsGrowth.futureGrowthPotential')
        ),
      ]),
    },
    ...dynamicInsightSections,
    {
      id: 'page08',
      label: 'Page 08 — Investment',
      fields: withContent([
        overrideField('page08.recommendedIntro', 'Pricing Notes', investmentExplanation, document, entryText(page08Entries, 'page08.recommendedIntro')),
        // Only written when real generated cards exist — an empty array would
        // otherwise serialize to the non-empty string "[]" and incorrectly
        // clobber the Editor's own DEFAULT_PAGE08_CARDS fallback.
        ...(page08Cards.length > 0
          ? [
              overrideField('page08.cards', 'Pricing Cards', serializeCollection(page08Cards), document, serializeCollection([])),
              // The frozen default hardcodes "Three ways" — derived from the
              // real card count so it can never disagree with how many
              // packages are actually shown (the bug that prompted this).
              overrideField(
                'page08.description',
                'Subtitle',
                derivePackagesDescription(page08Cards.length),
                document,
                entryText(page08Entries, 'page08.description')
              ),
            ]
          : []),
        overrideField('page08.block5', 'Combo — Package A Name', combo.block5, document, entryText(page08Blocks, 'page08.block5')),
        overrideField('page08.block6', 'Combo — Package A Price', combo.block6, document, entryText(page08Blocks, 'page08.block6')),
        overrideField('page08.block7', 'Combo — Package A Suffix', combo.block7, document, entryText(page08Blocks, 'page08.block7')),
        overrideField('page08.block9', 'Combo — Package B Name', combo.block9, document, entryText(page08Blocks, 'page08.block9')),
        overrideField('page08.block10', 'Combo — Package B Price', combo.block10, document, entryText(page08Blocks, 'page08.block10')),
        overrideField('page08.block11', 'Combo — Package B Suffix', combo.block11, document, entryText(page08Blocks, 'page08.block11')),
        overrideField(
          'page08.block13',
          'Combo — Outcome',
          content?.pages.page08.outcomeLine ?? '',
          document,
          entryText(page08Blocks, 'page08.block13')
        ),
        overrideField(
          'page08.block14',
          'Combo — Results',
          content?.pages.page08.resultsLine ?? '',
          document,
          entryText(page08Blocks, 'page08.block14')
        ),
      ]),
    },
    {
      id: 'page10',
      label: 'Page 10 — Agreement Metadata',
      fields: withContent([
        overrideField('page10.companyName', 'Company Name', blueprint.pages.page10.company, document, entryText(page10Entries, 'page10.companyName')),
        overrideField('page10.clientName', 'Client Name', blueprint.pages.page10.client, document, entryText(page10Entries, 'page10.clientName')),
      ]),
    },
    {
      id: 'page11',
      label: 'Page 11 — Closing',
      fields: withContent([overrideField('page11.envelopeMessage', 'Envelope Message', envelopeMessage, document, entryText(page11Entries, 'page11.envelopeMessage'))]),
    },
  ]

  return sections.filter((s) => s.fields.length > 0)
}

/**
 * Blueprint fields with no safe existing Builder target — informational
 * only, never written anywhere. Each reflects a genuine structural or
 * data gap (not a decision to "not build" the mapping): forcing content
 * into these would either require inventing a new field (Page 09), risk
 * corrupting a structured record with data the Blueprint doesn't have
 * (Page 08 packages), or break a multi-fragment layout designed around
 * distinct copy blocks (Page 06).
 */
export function getNotAvailableItems(): NotAvailableItem[] {
  return [
    {
      page: 'Page 06 — Implementation Roadmap',
      reason:
        'Page 06 is a multi-fragment case-study layout (13 distinct copy blocks) — no single field can safely hold one narrative paragraph without breaking its designed structure.',
    },
    {
      page: 'Page 09 — Timeline & Deliverables',
      reason: 'Page 09 has no editable timeline/deliverables fields in the current Builder — it renders a fixed layout.',
    },
    {
      page: 'Page 11 — Acceptance Message / Closing CTA',
      reason: 'No dedicated field exists yet for these in the current Builder.',
    },
    {
      page: 'Business Impact Calculations (Pages 04, 05, 08, 09)',
      reason:
        'There is no chart, table, or progress-indicator rendering capability anywhere in the Builder today — these calculations (lead growth, revenue growth, ROI, etc.) are saved as a reviewable record but not yet written into any page.',
    },
  ]
}
