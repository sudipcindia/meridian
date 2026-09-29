import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { TEMPLATE_PAGE_COMPONENTS } from '../../masterTemplate/pageComponents.js'
import { patchPreviewDom, getEditorKeyFromElement, type ResolvedBlock } from '../../modules/editor/domPatch.js'
import { useAssetReadyGate } from '../../modules/render/assetLoader.js'
import { useFitToWidthScale, useNativeContentHeight } from '../../modules/render/fitToWidth.js'
import { applyContentFit } from '../../modules/render/autoFitContent.js'
import type { TemplatePageId } from '../../masterTemplate/index.js'

interface LiveTemplatePreviewProps {
  pageId: TemplatePageId
  resolvedBlocks: ResolvedBlock[]
  onEditableClick: (blockKey: string, anchorRect: DOMRect) => void
  /** Real props passed straight into the page component — only used for pages with variable-length repeatable content (e.g. Page 07's `keywords`). Undefined for every other page, identical to today's zero-prop render. */
  pageProps?: Record<string, unknown>
  /** This page's number, computed by the caller from the document's actual page order (see `computePageNumbers` in masterTemplate/index.ts) — never hardcoded, so inserting/removing a page anywhere renumbers everything after it automatically. Merged into pageProps so every page component (all of which now accept an optional `pageNumber`) gets it regardless of whether it also has page-specific props. */
  pageNumber?: number
}

function PagePreviewLoadingScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-novara-dark rounded-lg">
      <Loader2 size={22} className="animate-spin text-novara-teal" />
      <span className="text-[12px] font-general-sans text-novara-light/40">Preparing proposal…</span>
    </div>
  )
}

/**
 * A `pageId` with no entry in TEMPLATE_PAGE_COMPONENTS resolves to
 * `undefined` — mounting `<undefined />` throws React error #130 and takes
 * down the whole render tree (this happened for real: a proposal saved with
 * page ids from an undeployed local build crashed its Review tab outright).
 * Rendering this instead keeps one bad/unknown page id from ever taking
 * anything else down with it.
 */
function UnknownPageFallback({ pageId }: { pageId: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-novara-dark rounded-lg text-center px-6">
      <span className="text-[13px] font-general-sans text-novara-light/60">Page "{pageId}" isn't available in this build.</span>
    </div>
  )
}

/**
 * Renders the real, unmodified master template page — read-only — for the
 * Editor's live preview. The template's own DOM/CSS is never touched.
 *
 * Two independent fixes are layered here, both operating purely on how the
 * Builder presents the template, never on the template itself:
 *
 * 1. Fit-to-width canvas (useFitToWidthScale/useNativeContentHeight): the
 *    template's fluid spacing uses `vw`, which is always relative to the
 *    real browser viewport — correct in the standalone client-facing site
 *    (where the template's wrapper occupies the full window) but wrong
 *    inside this editor's narrower side panel, where vw-relative content
 *    keeps sizing itself for the full window while being squeezed into a
 *    much smaller box. Fixed by rendering the page at its native width
 *    (window.innerWidth, so vw resolves correctly) and visually scaling
 *    the whole result down to fit — the same technique design tools use
 *    for their canvas.
 *
 * 2. Render-readiness gate (useAssetReadyGate): the page stays hidden
 *    (visibility, not display — so assets still load and it still lays
 *    out) behind a loading screen until fonts are ready, every image/
 *    logo/SVG has loaded, and the page's own forced "clean enter" remount
 *    (every frozen page bumps its own key right after mount, retriggering
 *    Framer Motion's transitions) has had time to settle.
 */
export function LiveTemplatePreview({ pageId, resolvedBlocks, onEditableClick, pageProps, pageNumber }: LiveTemplatePreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const PageComponent = TEMPLATE_PAGE_COMPONENTS[pageId]
  const isReady = useAssetReadyGate(containerRef, pageId)
  const { scale, nativeWidth } = useFitToWidthScale(panelRef)
  const nativeHeight = useNativeContentHeight(containerRef, pageId)

  // The MutationObserver below is intentionally NOT recreated on every
  // resolvedBlocks change (only when pageId changes, so editing doesn't tear
  // down/rebuild the observer on every keystroke) — so its callback must read
  // the latest blocks through a ref rather than closing over the
  // `resolvedBlocks` param directly, or it would keep re-patching stale
  // (e.g. pre-edit) text back in every time patchPreviewDom's own textContent
  // write below triggers the very childList mutation this observer watches.
  const resolvedBlocksRef = useRef(resolvedBlocks)
  resolvedBlocksRef.current = resolvedBlocks

  useLayoutEffect(() => {
    if (!containerRef.current) return
    patchPreviewDom(containerRef.current, resolvedBlocksRef.current)
    // Measuring overflow/collisions before fonts/images have finished loading
    // would fit against wrong metrics — only run once the same readiness gate
    // that reveals the page (below) says it's safe to measure. Re-runs on
    // every commit (content edits, page switches, isReady flipping true) same
    // as patchPreviewDom above.
    if (isReady) applyContentFit(containerRef.current)
  })

  // Re-patch after the frozen page's own forced remount recreates its DOM.
  // Independent of the readiness gate above — a save/edit must keep working
  // immediately even while a slow asset is still finishing its preload.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const observer = new MutationObserver(() => {
      patchPreviewDom(root, resolvedBlocksRef.current)
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pageId])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isReady) return
    const target = e.target as Element
    const blockKey = getEditorKeyFromElement(target)
    if (!blockKey) return
    const el = target.closest('[data-editor-key]') as HTMLElement | null
    if (!el) return
    e.preventDefault()
    // getBoundingClientRect() already reports the element's actual on-screen
    // (post-transform/post-scale) position, so the popover anchors correctly
    // with no extra scale math needed here.
    onEditableClick(blockKey, el.getBoundingClientRect())
  }

  return (
    <div
      ref={panelRef}
      className="relative w-full rounded-lg overflow-hidden border border-novara-border"
      // Falls back to a fixed min-height only until the first real
      // measurement lands (nativeHeight starts at 0) — guards the brief
      // window before the page's own lazy JS chunk has even resolved.
      style={nativeHeight ? { height: nativeHeight * scale } : { minHeight: 480 }}
    >
      <div
        ref={containerRef}
        onClick={handleClick}
        // Marks the one element whose *unscaled* layout height is this
        // page's real, true content height — see ProposalPdfView.tsx's
        // prepareForPrint(), which reads this element's scrollHeight
        // directly rather than trusting this component's own nativeHeight
        // state (which is scale/observer-driven and settles a render tick
        // later than the DOM itself, a real race PDF export hit — see that
        // file's own comment for the full story). Harmless in the Editor,
        // where nothing reads this attribute.
        data-print-content="true"
        // Mirrors `isReady` so ProposalPdfView.tsx's prepareForPrint() can
        // poll for every page's own async render-readiness gate (fonts +
        // images + Framer Motion settle, all per-page and independently
        // timed — see useAssetReadyGate's own doc comment) actually
        // finishing, instead of guessing a flat delay is enough for all of
        // them. With many pages worth of these gates running concurrently,
        // a flat guess was consistently too short for 2 of PulseFit
        // Studios Proposal's pages, which then got exported still
        // `visibility: hidden` — a real, reproduced bug, not a hypothetical.
        data-print-ready={isReady ? 'true' : 'false'}
        style={{
          width: nativeWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          visibility: isReady ? 'visible' : 'hidden',
        }}
        className="[&_[data-editor-key]]:cursor-text [&_[data-editor-key]:hover]:outline [&_[data-editor-key]:hover]:outline-1 [&_[data-editor-key]:hover]:outline-novara-teal/60"
      >
        {PageComponent ? (
          <Suspense fallback={null}>
            <PageComponent {...(pageProps ?? {})} {...(pageNumber !== undefined ? { pageNumber } : {})} />
          </Suspense>
        ) : (
          <UnknownPageFallback pageId={pageId} />
        )}
      </div>
      {!isReady && PageComponent && <PagePreviewLoadingScreen />}
    </div>
  )
}
