/**
 * Generic content-fitting pass for the frozen master template.
 *
 * The template (proposal/components/proposal/**) is approved, frozen, and
 * never edited — its typography is `clamp(minPx, Xvw, maxPx)` sized purely
 * off viewport width, with zero awareness of how much text a given field
 * actually holds. That's fine for the template's own short default copy,
 * but AI-generated content varies wildly in length per proposal, per
 * client, per field. Verified in the browser (not assumed from source) on
 * a real generated proposal, two concrete failure modes show up:
 *
 * 1. Big display headings are set `white-space: nowrap` (by design, so a
 *    short title like "RevOps"/"Proposal" renders as one crisp line) —
 *    a longer AI-generated heading just keeps extending horizontally
 *    instead of wrapping, spilling off both edges of the page.
 * 2. Several pages stack independent text blocks at fixed absolute
 *    positions (`top: X%`), sized for short placeholder copy — a longer
 *    AI-generated paragraph in an earlier block grows taller than its
 *    budgeted gap and visually collides with the next fixed-position
 *    block below it.
 *
 * Both are fixed here by measuring the ACTUAL rendered DOM after content
 * is patched in (modules/editor/domPatch.ts) and fonts/images are ready,
 * then nudging font-size down (never touching the template's own JSX/CSS)
 * until the measured problem goes away. Applies uniformly to every page,
 * every field — nothing here is keyed off a specific page id or field
 * name, so it holds for any future proposal's content, not just this one.
 */

const NATURAL_FONT_ATTR = 'data-natural-font-px'
const HEADING_FITTED_ATTR = 'data-autofit-heading'
const MIN_FONT_PX = 10
const NOWRAP_WIDTH_RATIO = 0.86
const MAX_BISECTION_STEPS = 14
const MAX_COLLISION_PASSES = 3
/**
 * Big nowrap headings are bounded to at most this many lines. Some of the
 * frozen template's pages (verified in source: contentBlocks.generated.ts)
 * expose exactly ONE scanner-detected text block for an entire page's
 * AI-generated body content, and that block happens to be a single accent
 * word inside a big display heading (e.g. Page03's whole "Current
 * Challenges" paragraph lands on the word "Practice." in "Our Approach in
 * Practice."). There's no other slot to redirect it to without editing the
 * frozen template. No amount of font-shrinking makes a multi-sentence
 * paragraph fit gracefully as a heading, so past this line budget the
 * heading is clamped with an ellipsis instead of ballooning into whatever
 * comes after it on the page — the full text is untouched in the database,
 * this only bounds how much of it this one heading-styled slot displays.
 */
const MAX_HEADING_LINES = 2

function naturalFontSize(el: HTMLElement): number {
  const stored = el.getAttribute(NATURAL_FONT_ATTR)
  if (stored) return parseFloat(stored)
  const px = parseFloat(getComputedStyle(el).fontSize) || 16
  el.setAttribute(NATURAL_FONT_ATTR, String(px))
  return px
}

function fitsWithinLines(el: HTMLElement, maxLines: number): boolean {
  const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight)
  if (!lineHeightPx) return true
  return el.scrollHeight <= lineHeightPx * maxLines + 1
}

function clampWithEllipsis(el: HTMLElement, maxLines: number): void {
  el.style.display = '-webkit-box'
  el.style.setProperty('-webkit-line-clamp', String(maxLines))
  el.style.setProperty('-webkit-box-orient', 'vertical')
  el.style.overflow = 'hidden'
  el.style.textOverflow = 'ellipsis'
}

/**
 * Fits one text-bearing element to `availableWidth`: shrinks its font-size
 * (bisection) so it wraps within MAX_HEADING_LINES, or — if even the
 * readable floor still needs more lines than that — clamps it with an
 * ellipsis at the floor size instead (see MAX_HEADING_LINES doc).
 */
function fitNowrapBlock(el: HTMLElement, availableWidth: number): void {
  el.setAttribute(HEADING_FITTED_ATTR, 'true')
  const naturalPx = naturalFontSize(el)
  el.style.whiteSpace = 'nowrap'
  el.style.fontSize = `${naturalPx}px`
  if (el.scrollWidth <= availableWidth) return // fits on one line at natural size — nothing to do

  el.style.whiteSpace = 'normal'
  el.style.overflowWrap = 'break-word'
  el.style.wordBreak = 'break-word'
  el.style.maxWidth = `${availableWidth}px`
  // An explicit width, not just max-width: verified in the browser that some
  // of these containers are centred via `left: 50%; transform:
  // translateX(-50%)` with no width of their own — the browser's
  // shrink-to-fit box-width calculation for that pattern is resolved BEFORE
  // the transform is applied, off the raw space from `left` to the
  // container's edge (half the container, here), completely ignoring
  // max-width. An explicit width overrides shrink-to-fit outright, so the
  // box actually gets the full available width regardless of how it's
  // positioned.
  el.style.width = `${availableWidth}px`

  let lo = Math.max(naturalPx * 0.3, MIN_FONT_PX)
  let hi = naturalPx
  el.style.fontSize = `${lo}px`
  if (!fitsWithinLines(el, MAX_HEADING_LINES)) {
    clampWithEllipsis(el, MAX_HEADING_LINES)
    return
  }

  for (let i = 0; i < MAX_BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2
    el.style.fontSize = `${mid}px`
    if (fitsWithinLines(el, MAX_HEADING_LINES)) lo = mid
    else hi = mid
  }
  el.style.fontSize = `${lo}px`
}

/**
 * Shrinks any element the template marked `white-space: nowrap` (inline
 * style, not inherited — precisely the big headings/labels the template
 * author intended to keep on one line) so its natural, unwrapped width
 * fits within a safe fraction of the page canvas.
 *
 * Some of these nowrap containers hold one logical heading line (e.g. a
 * label plus one inline accent span — Page03-05's "Our Approach in
 * Practice."); others hold several independently-meaningful lines as
 * separate child elements (Cover's title holds a `<p>` title AND a `<p>`
 * subtitle). `-webkit-line-clamp` doesn't clamp predictably across several
 * block-level children (verified in the browser: it does something, just
 * not "N total lines across both"), so a container with more than one
 * element child gets each child fitted independently instead of being
 * treated as one clampable unit.
 */
function shrinkNowrapOverflow(root: HTMLElement): void {
  const availableWidth = root.clientWidth * NOWRAP_WIDTH_RATIO
  if (!(availableWidth > 0)) return

  const candidates = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.style.whiteSpace === 'nowrap'
  )

  for (const el of candidates) {
    const elementChildren = Array.from(el.children).filter((c) => (c.textContent ?? '').trim()) as HTMLElement[]
    if (elementChildren.length > 1) {
      el.setAttribute(HEADING_FITTED_ATTR, 'true')
      for (const child of elementChildren) fitNowrapBlock(child, availableWidth)
    } else {
      fitNowrapBlock(el, availableWidth)
    }
  }
}

function rectsCollide(a: DOMRect, b: DOMRect): boolean {
  const horizontalOverlap = a.left < b.right && b.left < a.right
  const verticalOverlap = a.top < b.bottom && b.top < a.bottom
  return horizontalOverlap && verticalOverlap
}

/**
 * Shrinks `earlier` (the block that starts higher up) until its bottom edge
 * clears `later`'s top edge. If even the readable font floor still doesn't
 * leave enough room — the text is simply too long for the gap, no matter
 * the size — clamps it with an ellipsis to however many lines actually fit
 * in the space available, rather than leaving it shrunk-but-still-colliding.
 */
function shrinkUntilClear(earlier: HTMLElement, later: HTMLElement): void {
  const naturalPx = naturalFontSize(earlier)
  const fits = () => earlier.getBoundingClientRect().bottom <= later.getBoundingClientRect().top

  earlier.style.fontSize = `${naturalPx}px`
  if (fits()) return

  let lo = Math.max(naturalPx * 0.3, MIN_FONT_PX)
  let hi = naturalPx
  earlier.style.fontSize = `${lo}px`
  if (!fits()) {
    const availableHeight = later.getBoundingClientRect().top - earlier.getBoundingClientRect().top
    const lineHeightPx = parseFloat(getComputedStyle(earlier).lineHeight) || lo * 1.2
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightPx))
    clampWithEllipsis(earlier, maxLines)
    return
  }

  for (let i = 0; i < MAX_BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2
    earlier.style.fontSize = `${mid}px`
    if (fits()) lo = mid
    else hi = mid
  }
  earlier.style.fontSize = `${lo}px`
}

/**
 * Finds any two on-page blocks whose rendered boxes visually overlap (not
 * ancestor/descendant of each other) and shrinks whichever one starts
 * higher until the collision clears. Re-passes a few times since resolving
 * one collision can reveal or shift another. Includes `button` alongside
 * text elements — verified in the browser that a CTA button (e.g. Page 11's
 * "Accept the Proposal") sits between two text blocks and can end up
 * visually on top of the earlier one's last line even after that block no
 * longer collides with whatever comes after the button.
 */
function resolveTextCollisions(root: HTMLElement): void {
  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass++) {
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-editor-key], p, button')).filter(
      (el) => (el.textContent ?? '').trim().length > 0
    )

    let fixedAny = false
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]
        const b = blocks[j]
        if (a.contains(b) || b.contains(a)) continue
        const ra = a.getBoundingClientRect()
        const rb = b.getBoundingClientRect()
        if (!rectsCollide(ra, rb)) continue

        const [earlier, later] = ra.top <= rb.top ? [a, b] : [b, a]
        // A heading shrinkNowrapOverflow already fitted is left alone here —
        // resetting its font-size to natural to re-measure (as shrinkUntilClear
        // does) would undo that pass's own wrap/clamp sizing and could
        // fight with it (verified in the browser: without this guard, a
        // decorative floating tag merely brushing a heading's corner was
        // enough to make this pass re-clamp an already well-fitted title
        // down to one truncated word). Any residual overlap left in this
        // case is a decorative element grazing a heading, not the severe
        // multi-block collisions this pass exists to fix.
        if (earlier.hasAttribute(HEADING_FITTED_ATTR)) continue
        shrinkUntilClear(earlier, later)
        fixedAny = true
      }
    }
    if (!fixedAny) break
  }
}

/** Entry point — call after content is patched into the DOM and fonts/images are ready. Safe to call repeatedly (idempotent: always measures from each element's original natural size, never compounds shrinkage). */
export function applyContentFit(root: HTMLElement): void {
  shrinkNowrapOverflow(root)
  resolveTextCollisions(root)
}
