import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LiveTemplatePreview } from '../components/editor/LiveTemplatePreview.js'
import { PageFrameErrorBoundary } from '../components/editor/PageFrameErrorBoundary.js'
import { AcceptanceForm } from '../components/client/AcceptanceForm.js'
import { Modal } from '../components/Modal.js'
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
  parsePage07Keywords,
  deriveInvestmentSplit,
  parseCurrentPositionOverride,
  parseSwotOverride,
  parseGrowthOpportunitiesOverride,
  parseDynamicInsightPageOverride,
  type ContentBlockManifestEntry,
  type PricingCardRecord,
} from '../modules/variables/index.js'
import { fetchClientProposal, type ClientProposalData } from '../lib/clientProposal.js'
import { getOrCreateViewSessionId, reportViewDuration } from '../lib/viewSession.js'
import { computePageNumbers } from '../masterTemplate/index.js'
import { resolvePageProps, resolveDynamicInsightPages } from '../masterTemplate/resolvePageProps.js'

/**
 * The public, unauthenticated /p/:token route a client opens from their
 * email — no AppShell chrome, no login. Fetches content via
 * api/client/resolve.ts only (never the anon-key Supabase lib functions
 * used elsewhere) so a token can only ever unlock the one proposal it was
 * issued for. Renders every page in `document.pages` order through the
 * same `LiveTemplatePreview` the Editor and PDF view already use
 * (`onEditableClick` is a no-op — this view is read-only). Page 11's own
 * "Accept the Proposal" button (already part of the approved template,
 * previously decorative) opens the acceptance modal via `pageProps` —
 * nothing is appended below the template, and no other page is affected.
 */
export function ClientProposalView() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ClientProposalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchClientProposal(token, getOrCreateViewSessionId())
      .then((d) => {
        if (cancelled) return
        setData(d)
        setAccepted(d.alreadyAccepted)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token])

  // Best-effort "time spent" for the audit trail's View & Session
  // Analytics — reported once, whichever of pagehide/visibilitychange
  // fires first, via a beacon that can survive the tab actually closing
  // (a normal fetch would be cancelled at that point). See
  // src/lib/viewSession.ts's own doc comment — this can legitimately
  // never fire (killed process, blocked beacon), so it's always presented
  // as approximate, never exact.
  useEffect(() => {
    if (!data?.viewId) return
    const viewId = data.viewId
    const loadedAt = Date.now()
    let reported = false
    const report = () => {
      if (reported) return
      reported = true
      reportViewDuration(viewId, Date.now() - loadedAt)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') report()
    }
    window.addEventListener('pagehide', report)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', report)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [data?.viewId])

  const framesByPage = useMemo(() => {
    if (!data) return []
    return data.pages.map((pageId) => {
      // Cover/Page02/Page07/Page08/Page10/Page11/insightsBusiness/insightsGrowth's
      // fields are hand-authored (not scanner-generated — see e.g. page11Fields.ts),
      // so they're absent from
      // getContentBlocksForPage's manifest. Without merging them in here, a staff edit
      // (or this flow's AI-generated content) would never actually reach the real client:
      // the override exists in data.contentOverrides, but patchPreviewDom only patches keys
      // present in resolvedBlocks, so the DOM node would keep showing the template's raw
      // default text. Mirrors ProposalEditor.tsx's per-page entries (minus the editor-only
      // Page07 keyword / Page08 pricing-card expansions, which aren't needed to render).
      const generated = getContentBlocksForPage(pageId)
      let entries: ContentBlockManifestEntry[]
      if (pageId === 'cover') {
        entries = [...generated, ...getCoverFieldEntries({ clientName: data.variables.clientName })]
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
        entries = getPage10FieldEntries({ companyName: data.companyName, clientName: data.variables.clientName })
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
          resolvedText: resolveContentBlockText(entry, data.contentOverrides, data.variables),
          matchByText: pageId === 'page11' ? entry.key !== 'page11.envelopeMessage' : undefined,
        })),
      }
    })
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novara-dark">
        <span className="text-[13px] font-general-sans text-novara-light/50">Loading proposal…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novara-dark px-6 text-center">
        <span className="text-[14px] font-general-sans text-novara-light/70">{error}</span>
      </div>
    )
  }

  if (!data || framesByPage.length === 0) return null

  // Real, client-specific pricing cards — without this, page08 renders the
  // template's own hardcoded DEFAULT_PAGE08_CARDS (Website Refresh/Local SEO
  // Foundation/Local Authority SEO Growth at their default prices) instead
  // of whatever was actually generated/negotiated for this client. Cards are
  // a structured array, not a flat string, so patchPreviewDom's text-only
  // matching can never rebuild them — they must be passed as a real prop,
  // exactly as ProposalEditor.tsx's canvas already does.
  const page08Cards = normalizePricingCards(
    parseCollection<Partial<PricingCardRecord>>(data.contentOverrides['page08.cards'], DEFAULT_PAGE08_CARDS)
  )

  // Same reasoning as page08Cards above — the AI-selected visual block is a
  // structured object, not flat text, so it must be passed as a real prop
  // rather than relying on patchPreviewDom's text-only matching.
  const page07Enrichment = parseEnrichmentOverride(data.contentOverrides['page07.enrichment'])

  // Real generated demand keywords — a variable-length array (not flat text),
  // so (same reasoning as cards/enrichment above) it must be a real prop.
  // Previously missing entirely: every client has always been shown the
  // template's hardcoded DEFAULT_PAGE07_KEYWORDS ("Security company Bristol"
  // etc — the wrong industry for every real client) instead of their actual
  // generated keywords.
  const page07Keywords = parsePage07Keywords(data.contentOverrides['page07.keywords'])

  // Page 07's "Where Your Investment Goes" donut — always computed live from
  // the same real page08Cards above, never stored/AI-generated, so it can
  // never disagree with whatever pricing is actually shown on Page 08.
  const investmentSplit = deriveInvestmentSplit(page08Cards)

  // Business Intelligence structured fields (insightsBusiness/insightsGrowth
  // — premium pages inserted after Page 07, never the frozen Page 03/04) —
  // same reasoning as page08Cards/page07Enrichment above.
  const insightsBusinessCurrentPosition = parseCurrentPositionOverride(data.contentOverrides['insightsBusiness.currentPosition'])
  const insightsBusinessSwot = parseSwotOverride(data.contentOverrides['insightsBusiness.swot'])
  const insightsGrowthOpportunities = parseGrowthOpportunitiesOverride(data.contentOverrides['insightsGrowth.growthOpportunities'])

  // Whichever of the 8 reserved dynamicInsight0N slots are actually present
  // in this document's own page order — see masterTemplate/index.ts.
  const dynamicInsightPages = resolveDynamicInsightPages(data.pages, data.contentOverrides, parseDynamicInsightPageOverride)

  // Never hardcoded — computed from this document's actual page order, so
  // inserting/removing a page anywhere renumbers everything after it.
  const pageNumbers = computePageNumbers(data.pages)

  return (
    <div className="min-h-screen bg-novara-dark">
      {framesByPage.map((frame) => (
        <div key={frame.pageId}>
          <PageFrameErrorBoundary pageId={frame.pageId}>
            <LiveTemplatePreview
              pageId={frame.pageId}
              resolvedBlocks={frame.resolvedBlocks}
              onEditableClick={() => {}}
              pageNumber={pageNumbers[frame.pageId]}
              pageProps={
                frame.pageId === 'page11'
                  ? { onAcceptClick: () => setShowAcceptModal(true), alreadyAccepted: accepted, providerIdentity: data.providerIdentity }
                  : resolvePageProps(frame.pageId, {
                      page07Enrichment,
                      page07Keywords,
                      investmentSplit,
                      page08Cards,
                      insightsBusinessCurrentPosition,
                      insightsBusinessSwot,
                      insightsGrowthOpportunities,
                      dynamicInsightPages,
                      providerIdentity: data.providerIdentity,
                    })
              }
            />
          </PageFrameErrorBoundary>
        </div>
      ))}

      {showAcceptModal && (
        <Modal title="Accept the Proposal" onClose={() => setShowAcceptModal(false)}>
          <AcceptanceForm
            token={token!}
            proposalName={data.proposalName}
            companyName={data.companyName}
            providerIdentity={data.providerIdentity}
            onAccepted={() => setAccepted(true)}
          />
        </Modal>
      )}
    </div>
  )
}
