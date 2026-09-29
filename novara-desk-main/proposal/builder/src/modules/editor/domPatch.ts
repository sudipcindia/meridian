/**
 * Idempotent DOM text patching for the Proposal Editor's live preview.
 *
 * React state (variables + content overrides) is the only source of truth —
 * this module never reads state back out of the DOM. It only ever rewrites
 * text nodes from whatever `blocks` currently says, which makes it safe to
 * call after every keystroke AND after the master template's own forced
 * remounts (every page bumps an internal `animKey` right after mount "so
 * Framer Motion sees a clean enter," recreating its DOM on a timeline this
 * editor doesn't control) — there's nothing to reconcile, only to reapply.
 *
 * Matching works in two passes because the DOM's own text changes after the
 * first patch (it now shows resolved text, not the master template's
 * original text):
 *   1. Elements already tagged from a previous patch (data-editor-key) just
 *      get their text refreshed to the current resolvedText.
 *   2. Any remaining untagged text node is matched against the ORIGINAL
 *      template text (this is what a fresh/just-remounted DOM looks like)
 *      and gets tagged + patched for the first time.
 */

export interface ResolvedBlock {
  key: string
  originalText: string
  resolvedText: string
  /**
   * Whether this block should ever be discovered via untagged-text matching.
   * Defaults to true for the scanner-generated content blocks, which have no
   * other way to find their element (never carry a data-editor-key in
   * source). Hand-authored/dynamic fields (Cover/Page02/Page07/Page08's
   * fields, repeatable-collection items, etc.) already carry an explicit
   * data-editor-key directly in the template JSX, so they're always found by
   * the already-tagged pass on the very first render — set this to false for
   * them so their (often reused, e.g. a card's current title) originalText
   * can never collide with and steal some unrelated untagged element
   * elsewhere on the page that happens to contain the same literal text.
   */
  matchByText?: boolean
}

export const EDITOR_KEY_ATTR = 'data-editor-key'

export function patchPreviewDom(root: HTMLElement, blocks: ResolvedBlock[]): void {
  const byKey = new Map(blocks.map((b) => [b.key, b]))
  // Excludes: (1) blocks explicitly opted out of text-matching (see matchByText doc above), and
  // (2) blocks with empty (post-trim) originalText — a repeatable field that's currently blank
  // (e.g. an optional card footer note with no text) has no real DOM element to find here; its
  // target only exists when non-empty, and is pre-tagged via an explicit data-editor-key in that
  // case. Matching '' would instead grab the first incidental whitespace-only text node anywhere
  // in the tree (e.g. the literal space between two headline spans) and wrongly tag its parent.
  const byOriginal = new Map(
    blocks.filter((b) => b.matchByText !== false && b.originalText.trim() !== '').map((b) => [b.originalText, b])
  )

  const alreadyTagged = new Set<HTMLElement>()
  root.querySelectorAll<HTMLElement>(`[${EDITOR_KEY_ATTR}]`).forEach((el) => {
    const key = el.getAttribute(EDITOR_KEY_ATTR)
    const block = key ? byKey.get(key) : undefined
    if (!block) return
    alreadyTagged.add(el)
    if (el.textContent !== block.resolvedText) el.textContent = block.resolvedText
  })

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const toPatch: { node: Text; block: ResolvedBlock }[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const el = (node as Text).parentElement
    if (!el || alreadyTagged.has(el) || el.hasAttribute(EDITOR_KEY_ATTR)) continue
    const trimmed = node.textContent?.trim() ?? ''
    const block = byOriginal.get(trimmed)
    if (block) toPatch.push({ node: node as Text, block })
  }

  for (const { node: textNode, block } of toPatch) {
    const el = textNode.parentElement
    if (!el) continue
    el.setAttribute(EDITOR_KEY_ATTR, block.key)
    if (textNode.textContent !== block.resolvedText) textNode.textContent = block.resolvedText
  }
}

/** Walks up from a clicked DOM element to the nearest patched, editable block key (if any). */
export function getEditorKeyFromElement(el: Element): string | null {
  const match = el.closest(`[${EDITOR_KEY_ATTR}]`)
  return match ? match.getAttribute(EDITOR_KEY_ATTR) : null
}
