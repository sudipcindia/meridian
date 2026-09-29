import { CONTENT_BLOCK_MANIFEST, type ContentBlockManifestEntry } from './contentBlocks.generated.js'
import type { TemplatePageId } from '../../masterTemplate/index.js'

export type { ContentBlockManifestEntry }
export { CONTENT_BLOCK_MANIFEST }

/** Filters the full content-block manifest down to one page, preserving manifest order. */
export function getContentBlocksForPage(pageId: TemplatePageId): ContentBlockManifestEntry[] {
  return CONTENT_BLOCK_MANIFEST.filter((entry) => entry.page === pageId)
}
