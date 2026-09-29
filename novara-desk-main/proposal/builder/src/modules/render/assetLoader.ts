import { useEffect, useState, type RefObject } from 'react'

/**
 * Production render-readiness gate for the frozen template preview.
 *
 * The template pages (proposal/components/proposal/**) are approved,
 * unmodified Figma-to-code output — this module never touches them. What
 * was missing is a pipeline that waits for the page's actual assets before
 * revealing it: previously the editor rendered the page the instant its lazy
 * JS chunk resolved, with no regard for whether its fonts or images had
 * arrived yet. That produced exactly what was reported: cover layout shift,
 * missing/clipped sections on pages that wrap content in fixed-aspect-ratio
 * overflow:hidden containers (fallback-font metrics reflow once the real
 * font swaps in, and content laid out against the wrong metrics can get
 * clipped by those containers), slow-popping images on the page with the
 * largest source photos, and visible mid-transition Framer Motion states.
 *
 * Pipeline: fonts ready -> every image/background-image in the rendered
 * container preloaded -> a fixed settle window covering the page's own
 * "clean enter" forced remount and its resulting animations -> two flushed
 * animation frames -> only then is the page revealed.
 */

const IMAGE_LOAD_TIMEOUT_MS = 8000
const FONT_READY_TIMEOUT_MS = 4000
/** Safety ceiling so a pathological asset (or a fonts.ready that never resolves) can never leave the editor stuck on the loading screen forever. */
const OVERALL_TIMEOUT_MS = 15000

/**
 * Framer Motion doesn't expose one "every animation on this subtree is
 * done" promise across every animation strategy it uses internally, so this
 * is a fixed settle window instead of a real completion signal. Sized from
 * the actual longest transition found across the frozen template's page
 * components at the time this was written — duration up to 0.7s + delay up
 * to 0.3s, plus staggered per-item delays on list entrances — with margin.
 * Centralized here (not per page) so it never requires touching the frozen
 * template if those numbers change later.
 */
export const ANIMATION_SETTLE_MS = 1400

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([promise, wait(ms)])
}

/** Resolves once every currently-registered font has finished loading, or after a safety timeout. Never rejects, never hangs forever — a font API failure must not block rendering. */
export async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await withTimeout(document.fonts.ready.then(() => undefined), FONT_READY_TIMEOUT_MS)
  } catch {
    // Swallowed deliberately.
  }
}

/** Resolves once an image has loaded or failed (never rejects), so one broken asset can't block every other one. */
function preloadImageUrl(url: string): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve) => {
      const img = new Image()
      if (img.complete) {
        resolve()
        return
      }
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url
    }),
    IMAGE_LOAD_TIMEOUT_MS
  )
}

/**
 * Resolves once the container has real rendered children, or after a safety
 * timeout. Every page component is React.lazy-loaded (see
 * masterTemplate/pageComponents.ts) behind a `<Suspense fallback={null}>` —
 * this hook's container ref is attached to a wrapper div that mounts
 * immediately, before that lazy chunk has necessarily resolved. Without this
 * wait, a still-pending chunk means the container is genuinely empty at the
 * moment the pipeline below starts: collectImageUrls() finds zero images (there's
 * nothing inside yet), so preloadAssetsInContainer resolves instantly, and
 * isReady can flip true from the fixed settle window alone — before the real
 * content (and its Framer Motion enter animation) has ever painted. Puppeteer
 * then snapshots that page as an empty shell. Reproduced for real: with 18
 * pages' lazy chunks all requested concurrently for a PDF export, whichever
 * chunks happened to resolve slowest lost this race — a different, random
 * subset of pages came out blank on different export runs.
 */
function waitForMount(container: HTMLElement, timeoutMs: number): Promise<void> {
  if (container.childElementCount > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (container.childElementCount > 0 || Date.now() - start > timeoutMs) {
        resolve()
        return
      }
      setTimeout(check, 30)
    }
    check()
  })
}

/** Every url(...) found in an inline background-image style within the container. */
function collectBackgroundImageUrls(container: HTMLElement): string[] {
  const urls: string[] = []
  container.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const bg = el.style.backgroundImage
    if (!bg || bg === 'none') return
    const match = bg.match(/url\((['"]?)(.*?)\1\)/)
    if (match?.[2]) urls.push(match[2])
  })
  return urls
}

/**
 * Every image URL currently referenced within a rendered container — <img>
 * src (covers photos, icons, logos, and PNG/SVG assets alike, since this
 * codebase references all of them the same way) plus inline
 * background-image urls. Read directly off the live DOM rather than any
 * static per-page manifest, so it stays correct automatically no matter
 * which of the 11 pages is showing or how their asset lists change.
 */
function collectImageUrls(container: HTMLElement): string[] {
  const imgUrls = Array.from(container.querySelectorAll('img'))
    .map((img) => img.src)
    .filter(Boolean)
  return [...new Set([...imgUrls, ...collectBackgroundImageUrls(container)])]
}

/** Preloads every image/background-image/logo/SVG currently referenced within a rendered container. Resolves once all have loaded or safely timed out. */
export async function preloadAssetsInContainer(container: HTMLElement): Promise<void> {
  const urls = collectImageUrls(container)
  await Promise.all(urls.map(preloadImageUrl))
}

/** Flushes two animation frames — guarantees the browser has committed a real layout+paint cycle (not just a scheduled one) before revealing content. */
export function settleAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Drives the full render-readiness pipeline for whatever is currently
 * mounted inside `containerRef`, re-running whenever `resetKey` changes
 * (e.g. the page being previewed). Exposes `isReady` — the preview must
 * stay hidden behind a loading screen until this is true; never revealed
 * mid-load.
 */
export function useAssetReadyGate(containerRef: RefObject<HTMLElement>, resetKey: string | number): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    setIsReady(false)
    let cancelled = false

    async function runPipeline(target: HTMLElement) {
      const started = Date.now()
      await waitForMount(target, OVERALL_TIMEOUT_MS)
      await waitForFonts()
      // A short beat for the frozen page's own initial mount + its forced
      // "clean enter" remount (which fires almost immediately after first
      // mount, via a useEffect key bump) to occur, so the scan below reads
      // the DOM generation that actually stays, not one about to be torn
      // down and recreated a moment later.
      await wait(50)
      await preloadAssetsInContainer(target)
      const elapsed = Date.now() - started
      const remainingSettle = Math.max(ANIMATION_SETTLE_MS - elapsed, 0)
      await wait(Math.min(remainingSettle, Math.max(OVERALL_TIMEOUT_MS - elapsed, 0)))
      await settleAnimationFrames()
      if (!cancelled) setIsReady(true)
    }

    const timeoutGuard = setTimeout(() => {
      if (!cancelled) setIsReady(true)
    }, OVERALL_TIMEOUT_MS)

    void runPipeline(root).finally(() => clearTimeout(timeoutGuard))

    return () => {
      cancelled = true
      clearTimeout(timeoutGuard)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resetKey should restart the pipeline
  }, [resetKey])

  return isReady
}
