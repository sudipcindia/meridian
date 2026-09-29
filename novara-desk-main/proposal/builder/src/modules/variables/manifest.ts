import { TEMPLATE_VARIABLE_MANIFEST, type TemplateVariableManifestEntry } from './manifest.generated.js'
import type { TemplatePageId } from '../../masterTemplate/index.js'

export type { TemplateVariableManifestEntry }
export { TEMPLATE_VARIABLE_MANIFEST }

/** Filters the full manifest down to the variables relevant to a proposal's included pages, preserving manifest order. */
export function getVariableManifestForPages(pages: readonly TemplatePageId[]): TemplateVariableManifestEntry[] {
  const pageSet = new Set<string>(pages)
  return TEMPLATE_VARIABLE_MANIFEST.filter((entry) => entry.pages.some((p) => pageSet.has(p)))
}
