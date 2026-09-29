/**
 * PDF cache key — `documentVersion` already increments by exactly 1 on
 * every save (Phase 03's `updateDocumentContent`), so pairing it with the
 * document id is already a correct, sufficient invalidation key with zero
 * new version tracking needed.
 */
export function getPdfCacheKey(documentId: string, documentVersion: number): string {
  return `${documentId}/${documentVersion}`
}
