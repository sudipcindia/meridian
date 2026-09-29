/**
 * Proposal Intelligence Engine — Phase 04: Builder Population. Maps an
 * accepted Proposal Blueprint (Phase 03) onto fields the EXISTING Proposal
 * Builder already understands — every key referenced by this module
 * (variables and content-override keys) already exists today, already has
 * a template default, and is already wired into ProposalEditor.tsx's
 * click-to-edit popover. Nothing here introduces a new field, a new
 * table, or a new save mechanism — see src/lib/populateBuilder.ts, which
 * writes through the Builder's own `updateDocumentContent`.
 */

export type PopulationTargetType = 'variable' | 'override'

export interface PopulationField {
  key: string
  targetType: PopulationTargetType
  label: string
  /** What the Builder renders today for this field (an existing override/variable, or the template's own default if unset). */
  currentValue: string
  /** What the Blueprint suggests for this field. Fields are only included when this is non-empty. */
  suggestedValue: string
  /** True only when an EXPLICIT override/variable already exists and differs from the template's own default — never true just because the field is showing its untouched default (that default is always non-empty and would otherwise look like a false conflict on every never-edited field). */
  isCustomized: boolean
}

export interface PopulationSection {
  id: string
  label: string
  fields: PopulationField[]
}

/** A Blueprint field with no safe, existing Builder target — surfaced to the user, never written anywhere. */
export interface NotAvailableItem {
  page: string
  reason: string
}

export type SectionDecision = 'pending' | 'accept' | 'reject'

/** How to resolve a field whose current Builder content already differs from the AI suggestion (i.e. someone already edited it). */
export type ConflictResolution = 'replace' | 'merge' | 'keep_current'

/** True when this field already has explicit, customized content that differs from the AI suggestion — never true for a field still sitting at its untouched template default. */
export function hasFieldConflict(field: PopulationField): boolean {
  return field.isCustomized && field.currentValue !== field.suggestedValue
}

export function hasSectionConflict(section: PopulationSection): boolean {
  return section.fields.some(hasFieldConflict)
}

/** Applies a chosen conflict resolution to one field — 'keep_current' (or no resolution at all) never overwrites existing content, matching "AI must never overwrite manual edits without confirmation." */
export function computeFinalValue(field: PopulationField, resolution: ConflictResolution | undefined): string {
  if (!hasFieldConflict(field)) return field.suggestedValue
  if (resolution === 'replace') return field.suggestedValue
  if (resolution === 'merge') return `${field.currentValue}\n\n${field.suggestedValue}`
  return field.currentValue
}
