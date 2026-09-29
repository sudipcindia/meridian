import { updateDocumentContent } from './documents.js'
import type { ProposalDocument } from '../types/document.js'
import { computeFinalValue, type ConflictResolution, type PopulationSection } from '../modules/blueprintPopulate/index.js'

/**
 * Writes only the ACCEPTED sections into the Builder's existing document —
 * through updateDocumentContent, the exact same save path the Proposal
 * Editor's autosave and manual Save button already use (src/lib/documents.ts).
 * No new table, no new column, no new write mechanism. Starts from the
 * document's current variables/contentOverrides and merges in only the
 * keys covered by `sections`, so anything outside this feature's mapping
 * (or any section the caller excluded) is left completely untouched.
 */
export async function applyPopulation(
  document: ProposalDocument,
  acceptedSections: PopulationSection[],
  resolutions: Record<string, ConflictResolution>
): Promise<ProposalDocument> {
  const variables = { ...document.variables }
  const contentOverrides = { ...document.contentOverrides }

  for (const section of acceptedSections) {
    const resolution = resolutions[section.id]
    for (const field of section.fields) {
      const finalValue = computeFinalValue(field, resolution)
      if (field.targetType === 'variable') variables[field.key] = finalValue
      else contentOverrides[field.key] = finalValue
    }
  }

  return updateDocumentContent(document, { variables, contentOverrides })
}
