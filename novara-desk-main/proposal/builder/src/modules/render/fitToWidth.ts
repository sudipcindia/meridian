import { useEffect, useState, type RefObject } from 'react'

export interface FitToWidthResult {
  /** availableWidth / nativeWidth, clamped to a max of 1 — the canvas is never scaled up past 100%. */
  scale: number
  /** The width the template's own vw-relative clamp() sizing is calibrated against. */
  nativeWidth: number
}

/**
 * Root cause of the clipped/missing sections (verified in the frozen
 * template's own source, not assumed): every page's wrapper
 * (ProposalLayout.tsx's DesktopTabletWrapper) correctly sizes itself to
 * `w-full` of its container — but the CONTENT inside each page uses
 * `clamp(..., Xvw, ...)` for font sizes, gaps, and spacing, and `vw` is
 * ALWAYS relative to the real browser viewport (`window.innerWidth`) —
 * no ancestor width, position, or transform can change what it resolves
 * to. In the standalone client-facing site this is invisible, because the
 * wrapper's container happens to already be the full window width there.
 * Inside the Builder's editor, that wrapper instead sits in a side panel —
 * a fraction of the window, next to the page navigator — so vw-relative
 * content keeps sizing itself for the FULL window while being squeezed
 * into a much narrower box, overflowing the wrapper's overflow:hidden
 * boundary. That is the actual, evidenced cause of "missing" sections.
 *
 * Fix (the same technique design tools use for their canvas): render the
 * template at `window.innerWidth` — so every `vw` unit inside it resolves
 * exactly as it does in the standalone site — then apply a CSS
 * `transform: scale()` to the whole rendered result to fit the space the
 * Builder actually has available. The template's own DOM/CSS never
 * reflows or is asked to be a different width; only how the already-
 * correctly-rendered result is visually presented changes.
 */
export function useFitToWidthScale(panelRef: RefObject<HTMLElement>): FitToWidthResult {
  const [availableWidth, setAvailableWidth] = useState(0)
  const [nativeWidth, setNativeWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1920))

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (typeof width === 'number') setAvailableWidth(width)
    })
    observer.observe(el)
    setAvailableWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [panelRef])

  useEffect(() => {
    function handleResize() {
      setNativeWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const scale = nativeWidth > 0 && availableWidth > 0 ? Math.min(availableWidth / nativeWidth, 1) : 1

  return { scale, nativeWidth }
}

/**
 * The scaled canvas's on-screen height, needed so its (overflow-hidden,
 * explicitly-sized) outer frame in the Builder's layout matches exactly —
 * measured off the actual rendered content rather than assumed, since
 * different pages use different wrappers internally (DesktopTabletWrapper
 * is a fixed 16:9; MobileWrapper is a dynamic 100dvh stack) and this must
 * work correctly for either without hardcoding which one a given page uses.
 */
export function useNativeContentHeight(contentRef: RefObject<HTMLElement>, resetKey: string | number): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (typeof h === 'number' && h > 0) setHeight(h)
    })
    observer.observe(el)
    return () => observer.disconnect()
    // resetKey (pageId) is intentionally a dependency here even though it's
    // otherwise unused in the body — it forces a fresh observer/measurement
    // whenever the page being previewed changes.
  }, [contentRef, resetKey])

  return height
}
