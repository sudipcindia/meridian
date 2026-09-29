import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LiveTemplatePreview } from '../components/editor/LiveTemplatePreview.js'
import { PageFrameErrorBoundary } from '../components/editor/PageFrameErrorBoundary.js'
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
import { computePageNumbers, type TemplatePageId } from '../masterTemplate/index.js'
import { resolvePageProps, resolveDynamicInsightPages } from '../masterTemplate/resolvePageProps.js'
import type { ContentOverrideMap, VariableMap } from '../modules/variables/index.js'
import type { ProviderIdentity } from '../modules/branding/identity.js'

const PDF_STYLE_TAG_ID = 'pdf-page-styles'

interface PdfResolveData {
  pages: TemplatePageId[]
  variables: VariableMap
  contentOverrides: ContentOverrideMap
  providerIdentity: ProviderIdentity
}

/**
 * Print-ready, unauthenticated-by-route view (no AppShell chrome) rendered
 * only by the PDF engine's headless browser — never linked from the
 * regular UI. Stacks every page in `document.pages` (order preserved,
 * count auto-detected — never a hardcoded list) using the SAME
 * `LiveTemplatePreview` the Editor already uses; `onEditableClick` is a
 * no-op since this view is read-only. No new rendering logic lives here,
 * only composition + print-CSS bookkeeping.
 *
 * Fetches via api/pdf/resolve.ts (service-role) rather than the anon-key
 * lib functions used elsewhere — required once staff-only RLS is active
 * (Phase 08), since Chromium's request carries no Supabase Auth session.
 */
export function ProposalPdfView() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PdfResolveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/pdf/resolve?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || `Failed to load proposal (${res.status})`)
        return body
      })
      .then((body) => {
        if (cancelled) return
        setData({ pages: body.pages, variables: body.variables, contentOverrides: body.contentOverrides, providerIdentity: body.providerIdentity ?? 'novara' })
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load proposal'))
    return () => {
      cancelled = true
    }
  }, [id])

  const framesByPage = useMemo(() => {
    if (!data) return []
    return data.pages.map((pageId) => {
      // Cover/Page02/Page07/Page08/Page10/Page11/insightsBusiness/insightsGrowth's
      // fields are hand-authored (not scanner-generated), so they're absent from
      // getContentBlocksForPage's manifest.
      // Without merging them in here, the printed PDF would show the template's raw
      // default text instead of the real saved content — see ProposalEditor.tsx, the
      // reference implementation this mirrors (minus its editor-only Page07 keyword /
      // Page08 pricing-card expansions, which aren't needed to render).
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
        entries = getPage10FieldEntries({ companyName: data.variables.companyName, clientName: data.variables.clientName })
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
        })),
      }
    })
  }, [data])

  // Waits for fonts/images/animation-settle, then measures each frame,
  // classifies it (slide vs document — see modules/pdf/frameSizing.ts),
  // injects per-frame @page CSS, and signals readiness for the PDF engine.
  useEffect(() => {
    if (framesByPage.length === 0 || !containerRef.current) return
    let cancelled = false

    // Bounds a promise that could otherwise hang forever — e.g. a known
    // Chromium quirk where `document.fonts.ready` never settles if a
    // @font-face fails to apply cleanly, or a stray <img> whose load/error
    // listeners never fire. Without this, one stuck promise means
    // `data-pdf-ready` is never set and every PDF export times out and
    // fails outright, which is worse than proceeding with a page that may
    // be a font-swap or one image behind.
    function withTimeout(promise: Promise<unknown>, ms: number) {
      return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])
    }

    async function prepareForPrint() {
      try {
        await withTimeout(window.document.fonts.ready as unknown as Promise<unknown>, 8000)

        const images = Array.from(containerRef.current!.querySelectorAll('img'))
        await withTimeout(
          Promise.all(
            images.map(
              (img) =>
                new Promise<void>((resolve) => {
                  if (img.complete) return resolve()
                  img.addEventListener('load', () => resolve(), { once: true })
                  img.addEventListener('error', () => resolve(), { once: true })
                })
            )
          ),
          20000
        )

        const settleMs = Number(new URLSearchParams(window.location.search).get('settleMs')) || 1500
        await new Promise((resolve) => setTimeout(resolve, settleMs))

        // Each LiveTemplatePreview instance reveals its page independently,
        // once its OWN fonts/images/animation-settle gate (useAssetReadyGate)
        // resolves — not on this function's own flat timers above. With
        // every page's gate running concurrently, a fixed delay here is a
        // guess, and was confirmed too short for some pages in real testing
        // (PulseFit Studios Proposal exported 2 pages still
        // `visibility: hidden`, printing as blank). Poll the real signal —
        // every page's own data-print-ready flag — rather than guessing
        // again with a longer fixed number.
        await withTimeout(
          (async () => {
            while (!cancelled) {
              const allReady = Array.from(containerRef.current!.querySelectorAll<HTMLElement>('[data-print-content]')).every(
                (el) => el.dataset.printReady === 'true'
              )
              if (allReady) return
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          })(),
          10000
        )
      } catch (err) {
        console.error('ProposalPdfView: prepareForPrint failed, proceeding anyway', err)
      }
      if (cancelled) return

      // Every page gets its own PDF page sized to its ACTUAL rendered
      // height, never a fixed paper size — this used to branch on a
      // "slide vs document" classification and force Page06/Page10 (both
      // much taller than a 16:9 slide) onto repeated fixed-height A4
      // pages instead. Since neither page's content was authored to
      // reflow across print margins (Page06 is a card/image grid, Page10
      // is flex sections with `break-inside: avoid` far taller than one
      // A4 page can hold), that forced pagination fragmented them across
      // many mostly-blank pages instead of the one continuous page the
      // live preview always shows. Matching the preview 1:1 — one PDF
      // page per logical template page, at that page's own full height —
      // is what actually reflects "the same visual design/layout as the
      // preview" for every page, slide-shaped or not.
      //
      // Height is read from LiveTemplatePreview's own `[data-print-content]`
      // element via `scrollHeight` — its OWN true, unscaled, unclipped
      // layout height — rather than the `[data-frame-index]` wrapper's
      // getBoundingClientRect(). That wrapper's rendered size is driven by
      // LiveTemplatePreview's `nativeHeight` React state (set asynchronously
      // by a ResizeObserver callback, for the Editor's narrow-panel
      // fit-to-width scaling — see that file's own doc comment), which is
      // still just `minHeight: 480` until its own observer fires and a
      // render commits; a genuine race against this function's fixed settle
      // timers when many pages mount at once. `scrollHeight` needs no such
      // round trip — it's the browser's own current layout size, correct
      // the instant this line runs.
      const frames = Array.from(containerRef.current!.querySelectorAll<HTMLElement>('[data-frame-index]'))
      const rules: string[] = []

      frames.forEach((frame, i) => {
        const content = frame.querySelector<HTMLElement>('[data-print-content]')
        const width = content?.clientWidth || frame.getBoundingClientRect().width
        const height = content?.scrollHeight || frame.getBoundingClientRect().height
        const pageName = `pdf-page-${i}`

        frame.style.setProperty('page', pageName)
        frame.style.setProperty('break-after', 'page')
        frame.style.setProperty('break-inside', 'avoid')

        // ProposalBackground paints its dark base as a background IMAGE (a
        // data-URI SVG containing a radial gradient) sized with
        // background-size, and a secondary teal glow as a CSS gradient
        // clipped through an image mask sized with mask-size. Both are
        // correct on screen (independently verified live in the browser:
        // dark navy with a top glow, matching every other page) — but
        // proven, by direct isolation test, wrong specifically through
        // Chromium's print-to-PDF pass on this pipeline's per-page custom
        // @page sizing: setting backgroundSize/maskSize to an explicit
        // pixel value (confirmed correct via computed style logged right
        // before capture) still produced a solid-teal page in the actual
        // PDF, while outright hiding both layers produced the correct
        // dark page — meaning Chromium's print engine isn't reliably
        // honouring background-size/mask-size on an image asset here, for
        // reasons not worth chasing further.
        //
        // Fix: stop depending on background-size entirely for the base
        // layer. A radial-gradient() is a computed CSS value, not an
        // image needing a separate sizing step — mathematically
        // reproducing the SVG's own gradient (same ellipse centre/radii,
        // decoded from its gradientTransform matrix, same three colour
        // stops) via a plain `background` string sidesteps the whole
        // mechanism. Scaled by this frame's own already-measured pixel
        // width, so it's pixel-identical to the 1920px design reference
        // regardless of a page's actual rendered width. The secondary
        // glow layer's decorative grid-line mask can't be reproduced this
        // way (mask-image has no gradient-only equivalent) — dropped for
        // print only; the isolation test showed the page still reads
        // correctly (dark navy, matching its neighbours) without it.
        const bgBase = frame.querySelector<HTMLElement>('[data-proposal-bg="base"]')
        const bgGlow = frame.querySelector<HTMLElement>('[data-proposal-bg="glow"]')
        if (bgBase) {
          const scale = width / 1920
          const cx = Math.round(935 * scale)
          const cy = Math.round(-894 * scale)
          const rx = Math.round(2389.3 * scale)
          const ry = Math.round(1344 * scale)
          bgBase.style.background =
            `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, rgba(7,80,86,0.16) 0%, rgba(10,53,59,0.58) 50%, rgba(13,26,31,1) 100%), #0D1A1F`
        }
        if (bgGlow) bgGlow.style.display = 'none'

        rules.push(`@page ${pageName} { size: ${Math.round(width)}px ${Math.round(height)}px; margin: 0; }`)
      })

      let styleTag = window.document.getElementById(PDF_STYLE_TAG_ID) as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = window.document.createElement('style')
        styleTag.id = PDF_STYLE_TAG_ID
        window.document.head.appendChild(styleTag)
      }
      styleTag.textContent = rules.join('\n')

      window.document.body.setAttribute('data-pdf-ready', 'true')
    }

    prepareForPrint()
    return () => {
      cancelled = true
    }
  }, [framesByPage])

  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>
  if (!data || framesByPage.length === 0) return null

  // Real, client-specific structured content — a real bug found and fixed
  // here: this view previously passed NO pageProps at all, unlike the other
  // three render call sites (Editor/Review/ClientProposalView), meaning
  // every PDF export silently showed the frozen template's hardcoded
  // defaults for Pages 03/04/07/08 instead of the real generated content.
  // See ProposalReviewPage.tsx for the identical computation this mirrors.
  const page08Cards = normalizePricingCards(
    parseCollection<Partial<PricingCardRecord>>(data.contentOverrides['page08.cards'], DEFAULT_PAGE08_CARDS)
  )
  const page07Enrichment = parseEnrichmentOverride(data.contentOverrides['page07.enrichment'])
  const page07Keywords = parsePage07Keywords(data.contentOverrides['page07.keywords']) ?? DEFAULT_PAGE07_KEYWORDS
  const investmentSplit = deriveInvestmentSplit(page08Cards)
  const insightsBusinessCurrentPosition =
    parseCurrentPositionOverride(data.contentOverrides['insightsBusiness.currentPosition']) ?? DEFAULT_INSIGHTS_BUSINESS_CURRENT_POSITION
  const insightsBusinessSwot = parseSwotOverride(data.contentOverrides['insightsBusiness.swot']) ?? DEFAULT_INSIGHTS_BUSINESS_SWOT
  const insightsGrowthOpportunities =
    parseGrowthOpportunitiesOverride(data.contentOverrides['insightsGrowth.growthOpportunities']) ?? DEFAULT_INSIGHTS_GROWTH_OPPORTUNITIES
  const page07EnrichmentSafe = page07Enrichment ?? DEFAULT_PAGE07_ENRICHMENT

  // Whichever of the 8 reserved dynamicInsight0N slots are actually present
  // in this document's own page order — see masterTemplate/index.ts.
  const dynamicInsightPages = resolveDynamicInsightPages(data.pages, data.contentOverrides, parseDynamicInsightPageOverride)

  // Never hardcoded — computed from this document's actual page order, so
  // inserting/removing a page anywhere renumbers everything after it.
  const pageNumbers = computePageNumbers(data.pages)

  return (
    <div ref={containerRef} style={{ background: '#0D1A1F' }}>
      {framesByPage.map((frame, i) => (
        <div key={frame.pageId} data-frame-index={i} data-page-id={frame.pageId}>
          <PageFrameErrorBoundary pageId={frame.pageId}>
            <LiveTemplatePreview
              pageId={frame.pageId}
              resolvedBlocks={frame.resolvedBlocks}
              onEditableClick={() => {}}
              pageNumber={pageNumbers[frame.pageId]}
              pageProps={resolvePageProps(frame.pageId, {
                page07Enrichment: page07EnrichmentSafe,
                page07Keywords,
                investmentSplit,
                page08Cards,
                insightsBusinessCurrentPosition,
                insightsBusinessSwot,
                insightsGrowthOpportunities,
                dynamicInsightPages,
                providerIdentity: data.providerIdentity,
              })}
            />
          </PageFrameErrorBoundary>
        </div>
      ))}
    </div>
  )
}
