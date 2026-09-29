/**
 * Deterministic JSON serialization for hashing (see src/lib/documentHash.ts
 * and api/_lib/audit/documentHash.ts, the two thin per-runtime wrappers
 * around this). Object keys are sorted recursively so two logically
 * identical documents never produce different hashes purely because of
 * key-insertion-order differences — array order is preserved, since order
 * is semantically significant there (e.g. page order).
 *
 * Isomorphic (no Node- or browser-only APIs) so the exact same function
 * runs on both sides of the "was this document modified since signing"
 * comparison — the server hashes at accept time, the browser re-hashes
 * the current document at Overview-page render time, and SHA-256 of
 * identical canonical input is guaranteed identical output in either
 * runtime.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}
