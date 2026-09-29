/**
 * Placeholder registry — re-exported from the auto-generated manifest
 * (see manifest.generated.ts), which is produced by scripts/scanVariables.mjs
 * scanning the approved master template (proposal/components/proposal/*.tsx)
 * directly. Nothing here is hand-typed: run `npm run scan:variables` to
 * regenerate after the master template changes (a new page, a new
 * placeholder) — no other architectural change is required.
 *
 * "[Company Name]" and "[Business Name]" are kept as two independent keys
 * (`companyName`, `businessName`) even though they mean the same thing in
 * different pages of the approved template — merging them would require
 * hardcoded semantic knowledge the scanner can't (and shouldn't) have.
 * `getDefaultVariables` (engine.ts) seeds `businessName` from `companyName`
 * on creation so both start filled; they remain independently editable.
 */

export { PLACEHOLDER_REGISTRY } from './manifest.generated.js'
import { PLACEHOLDER_REGISTRY } from './manifest.generated.js'

export type PlaceholderToken = keyof typeof PLACEHOLDER_REGISTRY
export type VariableKey = (typeof PLACEHOLDER_REGISTRY)[PlaceholderToken]

export const PLACEHOLDER_TOKENS = Object.keys(PLACEHOLDER_REGISTRY) as PlaceholderToken[]
