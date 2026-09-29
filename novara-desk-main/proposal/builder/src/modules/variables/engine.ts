import { PLACEHOLDER_REGISTRY, PLACEHOLDER_TOKENS, type PlaceholderToken } from './placeholders.js'
import type { ContentBlockManifestEntry } from './contentBlocks.js'

/**
 * A document's variable values, keyed by the canonical variable key (not
 * the bracket token). Keyed by plain `string` rather than the current
 * `VariableKey` union so it stays valid across re-scans that add or remove
 * placeholders — `VariableKey` itself is still exported for code that wants
 * to reference today's known keys explicitly (e.g. `getDefaultVariables`).
 */
export type VariableMap = Partial<Record<string, string>>

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replaces every known bracket placeholder in `text` with its value from
 * `variables`. A placeholder with no value supplied is left exactly as
 * written, so unfilled placeholders stay visibly obvious rather than
 * disappearing — the master template's own placeholder format is never
 * altered by this function, only substituted into a copy of the text.
 */
export function applyVariables(text: string, variables: VariableMap): string {
  let result = text
  for (const token of PLACEHOLDER_TOKENS) {
    const key = PLACEHOLDER_REGISTRY[token]
    const value = variables[key]
    if (value === undefined || value === '') continue
    result = result.replace(new RegExp(escapeRegExp(token), 'g'), value)
  }
  return result
}

/** Returns which known placeholders are present in `text` (e.g. to preview what a page still needs filled in). */
export function extractPlaceholders(text: string): PlaceholderToken[] {
  return PLACEHOLDER_TOKENS.filter((token) => text.includes(token))
}

/** Minimal shape needed to seed a document's starting variables from its proposal's metadata. */
export interface VariableSeedSource {
  clientName: string
  clientFirstName: string
  companyName: string
}

/**
 * Seeds the variables an existing Proposal already implies (client/company
 * name), leaving placeholders with no metadata equivalent (service type,
 * location, website link) unset for the future Proposal Editor to fill in.
 *
 * "[Business Name]" and "[Company Name]" are independent variable keys
 * (see placeholders.ts) since the scanner can't know they're synonyms — but
 * they mean the same thing in the approved template, so `businessName` is
 * seeded from the same metadata field as a first-run convenience. Both
 * remain independently editable afterward.
 */
export function getDefaultVariables(source: VariableSeedSource): VariableMap {
  const variables: VariableMap = {}
  if (source.clientName) variables.clientName = source.clientName
  if (source.clientFirstName) variables.clientFirstName = source.clientFirstName
  if (source.companyName) {
    variables.companyName = source.companyName
    variables.businessName = source.companyName
  }
  return variables
}

/** A document's free-text overrides for generic content blocks, keyed by block key. */
export type ContentOverrideMap = Partial<Record<string, string>>

/**
 * Resolves the final text for one content block: an override (if the staff
 * member has edited it) wins over the master template's original text —
 * either way, known variables are still substituted into whichever text is
 * active, so editing a block that also contains e.g. "[Client Name]" keeps
 * working exactly like the original. This is the one substitution engine
 * used both by the plain-text Variables panel preview and by the Editor's
 * live DOM patching — no page implements its own replacement logic.
 */
export function resolveContentBlockText(
  entry: ContentBlockManifestEntry,
  overrides: ContentOverrideMap,
  variables: VariableMap
): string {
  return applyVariables(overrides[entry.key] ?? entry.originalText, variables)
}
