import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { ProposalTabs } from '../components/ProposalTabs.js'
import { ApprovalStatusControl } from '../components/review/ApprovalStatusControl.js'
import { LiveTemplatePreview } from '../components/editor/LiveTemplatePreview.js'
import { PageFrameErrorBoundary } from '../components/editor/PageFrameErrorBoundary.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { getProposal } from '../lib/proposals.js'
import { getDocumentByProposalId } from '../lib/documents.js'
import { getAnalysisSummaryForProposal, type AnalysisRecord } from '../lib/analyses.js'
import { computePageNumbers } from '../masterTemplate/index.js'
import { resolvePageProps, resolveDynamicInsightPages } from '../masterTemplate/resolvePageProps.js'
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
  resolveContentBlockText,
  parseCollection,
  normalizePricingCards,
  DEFAULT_PAGE08_CARDS,
  parseEnrichmentOverride,
  DEFAULT_PAGE07_ENRICHMENT,
  parsePage07Keywords,
  DEFAULT_PAGE07_KEYWORDS,
  deriveInvestmentSplit,
  parseCurrentPositionOverride,
  DEFAULT_INSIGHTS_BUSINESS_CURRENT_POSITION,
  parseSwotOverride,
  DEFAULT_INSIGHTS_BUSINESS_SWOT,
  parseGrowthOpportunitiesOverride,
  DEFAULT_INSIGHTS_GROWTH_OPPORTUNITIES,
  parseDynamicInsightPageOverride,
  type ContentBlockManifestEntry,
  type PricingCardRecord,
} from '../modules/variables/index.js'
import type { Proposal } from '../types/proposal.js'
import type { ProposalDocument } from '../types/document.js'

/**
 * Review tab: Proposal Preview (the real template, read-only — reuses
 * LiveTemplatePreview, no separate rendering path), AI Analysis Summary
 * (only when this proposal came from the AI Proposal Generator — see
 * lib/createProposalFromAnalysis.ts), and Approve. Sending lives on its
 * own Send tab (see ProposalSendPage.tsx) — no health score, no
 * validation gates, no dropdown, no notes.
 */
export function ProposalReviewPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [document, setDocument] = useState<ProposalDocument | null>(null)
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getDocumentByProposalId(id), getAnalysisSummaryForProposal(id)])
      .then(([p, d, summary]) => {
        if (cancelled) return
        setProposal(p)
        setDocument(d)
        setAnalysisSummary(summary)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const framesByPage = useMemo(() => {
    if (!document || !proposal) return []
    return document.pages.map((pageId) => {
      const generated = getContentBlocksForPage(pageId)
      // Cover/Page02/Page07/Page08/Page10/Page11's AI-generated and Population-assigned
      // fields are prop-backed, not scanner-detected literal JSX text, so they're absent
      // from getContentBlocksForPage's manifest (see ProposalEditor.tsx, the reference
      // implementation this mirrors). Without merging them in here, this read-only preview
      // renders the template's raw hardcoded defaults instead of the real saved content.
      let entries: ContentBlockManifestEntry[]
      if (pageId === 'cover') {
        entries = [...generated, ...getCoverFieldEntries({ clientName: proposal.clientName, preparedBy: proposal.preparedBy })]
      } else if (pageId === 'page02') {
        entries = [...generated, ...getPage02FieldEntries()]
      } else if (pageId === 'insightsBusiness') {
        entries = [...generated, ...getInsightsBusinessFieldEntries()]
      } else if (pageId === 'insightsGrowth') {
        entries = [...generated, ...getInsightsGrowthFieldEntries()]
      } else if (pageId === 'page07') {
        entries = [...generated, ...getPage07FieldEntries()]
      } else if (pageId === 'page08') {
        entries = [...generated, ...getPage08FieldEntries()]
      } else if (pageId === 'page10') {
        entries = getPage10FieldEntries({ companyName: proposal.companyName, clientName: proposal.clientName })
      } else if (pageId === 'page11') {
        entries = [...generated, ...getPage11FieldEntries()]
      } else {
        entries = generated
      }
      return {
        pageId,
        resolvedBlocks: entries.map((entry) => ({
          key: entry.key,
          originalText: entry.originalText,
          resolvedText: resolveContentBlockText(entry, document.contentOverrides, document.variables),
          matchByText: pageId === 'page11' ? entry.key !== 'page11.envelopeMessage' : undefined,
        })),
      }
    })
  }, [document, proposal])

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (error) return <div className="px-8 py-6"><ErrorBanner message={error} /></div>
  if (!proposal) return null

  // Real, client-specific pricing cards — see ClientProposalView.tsx for why
  // this can't be covered by resolvedBlocks' text-only patching (cards are a
  // structured array, not a flat string). Without this, staff review a page08
  // that never matches what a client will actually be sent.
  const page08Cards = document
    ? normalizePricingCards(parseCollection<Partial<PricingCardRecord>>(document.contentOverrides['page08.cards'], DEFAULT_PAGE08_CARDS))
    : DEFAULT_PAGE08_CARDS

  // Same reasoning as page08Cards above — the AI-selected visual block is a
  // structured object, not flat text, so it must be passed as a real prop.
  const page07Enrichment = document ? parseEnrichmentOverride(document.contentOverrides['page07.enrichment']) : DEFAULT_PAGE07_ENRICHMENT

  // Real generated demand keywords — same reasoning, previously missing
  // entirely (see ClientProposalView.tsx for the client-facing impact).
  const page07Keywords = document ? parsePage07Keywords(document.contentOverrides['page07.keywords']) : DEFAULT_PAGE07_KEYWORDS

  // Same reasoning as page08Cards above — always computed live, never stored.
  const investmentSplit = deriveInvestmentSplit(page08Cards)

  // Business Intelligence structured fields (insightsBusiness/insightsGrowth
  // — premium pages inserted after Page 07, never the frozen Page 03/04) —
  // same reasoning as page08Cards/page07Enrichment above.
  const insightsBusinessCurrentPosition = document
    ? parseCurrentPositionOverride(document.contentOverrides['insightsBusiness.currentPosition'])
    : DEFAULT_INSIGHTS_BUSINESS_CURRENT_POSITION
  const insightsBusinessSwot = document
    ? parseSwotOverride(document.contentOverrides['insightsBusiness.swot'])
    : DEFAULT_INSIGHTS_BUSINESS_SWOT
  const insightsGrowthOpportunities = document
    ? parseGrowthOpportunitiesOverride(document.contentOverrides['insightsGrowth.growthOpportunities'])
    : DEFAULT_INSIGHTS_GROWTH_OPPORTUNITIES

  // Whichever of the 8 reserved dynamicInsight0N slots are actually present
  // in this document's own page order — see masterTemplate/index.ts.
  const dynamicInsightPages = resolveDynamicInsightPages(
    document?.pages ?? [],
    document?.contentOverrides ?? {},
    parseDynamicInsightPageOverride
  )

  // Never hardcoded — computed from this document's actual page order, so
  // inserting/removing a page anywhere renumbers everything after it.
  const pageNumbers = computePageNumbers(document?.pages ?? [])

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Internal review only — no client access" />
      <div className="px-8"><ProposalTabs proposalId={id} /></div>

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        {analysisSummary && (
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">AI Analysis Summary</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Client</label>
                <p className="text-sm font-general-sans text-white/90">{analysisSummary.proposalData.clientName || '—'}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Company</label>
                <p className="text-sm font-general-sans text-white/90">{analysisSummary.proposalData.companyName || '—'}</p>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Summary</label>
                <p className="text-sm font-general-sans text-white/90 whitespace-pre-line">{analysisSummary.proposalData.summary || '—'}</p>
              </div>
              {analysisSummary.proposalData.painPoints.length > 0 && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Pain Points</label>
                  <p className="text-sm font-general-sans text-white/90 whitespace-pre-line">{analysisSummary.proposalData.painPoints.join('\n')}</p>
                </div>
              )}
              {analysisSummary.proposalData.recommendation && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Recommendation</label>
                  <p className="text-sm font-general-sans text-white/90 whitespace-pre-line">{analysisSummary.proposalData.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <ApprovalStatusControl proposal={proposal} onStatusChanged={setProposal} />

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Proposal Preview</p>
          <div className="border border-novara-border rounded-xl overflow-hidden flex flex-col gap-4 p-2">
            {framesByPage.map((frame) => (
              <PageFrameErrorBoundary key={frame.pageId} pageId={frame.pageId} internal>
                <LiveTemplatePreview
                  pageId={frame.pageId}
                  resolvedBlocks={frame.resolvedBlocks}
                  onEditableClick={() => {}}
                  pageNumber={pageNumbers[frame.pageId]}
                  pageProps={resolvePageProps(frame.pageId, {
                    page07Enrichment,
                    page07Keywords,
                    investmentSplit,
                    page08Cards,
                    insightsBusinessCurrentPosition,
                    insightsBusinessSwot,
                    insightsGrowthOpportunities,
                    dynamicInsightPages,
                    providerIdentity: proposal.providerIdentity,
                  })}
                />
              </PageFrameErrorBoundary>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
