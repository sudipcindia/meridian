// Generic helpers for Builder-editable repeatable collections (pricing cards,
// FAQs, testimonials, service blocks, case studies, timelines, feature lists,
// comparison tables, etc.) — introduced for Page 08 and intended to be reused
// as-is for Pages 09-11 rather than reimplemented per page.
//
// Storage convention: a collection is always ONE JSON-stringified array under
// a single key in the existing `contentOverrides` map (e.g. 'page08.cards')
// — no new tables, no new document fields. Each item is a plain object; give
// it a stable `id` (see `makeCollectionId`) so per-item edits, undo/redo, and
// React keys stay correct across reorders.

/** Safely parses a collection out of its JSON-stringified contentOverride, falling back to a default array if missing, malformed, or shape-mismatched. */
export function parseCollection<T>(raw: string | undefined, fallback: T[]): T[] {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

export function serializeCollection<T>(items: T[]): string {
  return JSON.stringify(items)
}

/** Short, collision-safe-enough id for a new collection item (cards/features/etc. never need cryptographic uniqueness, just stability across reorders within one document). */
export function makeCollectionId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function addCollectionItem<T>(items: T[], newItem: T): T[] {
  return [...items, newItem]
}

export function removeCollectionItem<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index)
}

export function duplicateCollectionItem<T>(items: T[], index: number, cloneWithNewId?: (item: T) => T): T[] {
  const next = [...items]
  const source = next[index]
  const clone = cloneWithNewId ? cloneWithNewId(source) : JSON.parse(JSON.stringify(source))
  next.splice(index + 1, 0, clone)
  return next
}

export function reorderCollectionItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function updateCollectionItem<T>(items: T[], index: number, patch: Partial<T>): T[] {
  const next = [...items]
  next[index] = { ...next[index], ...patch }
  return next
}
