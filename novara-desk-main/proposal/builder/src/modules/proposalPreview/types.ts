/**
 * Proposal Intelligence Engine — Phase 07: Proposal Orchestrator. The
 * Proposal Preview is a purely DERIVED view — assembled live from the
 * existing Proposal Intelligence, Blueprint, Sales Content, and Business
 * Impact records — never its own stored object. "Do not create
 * unnecessary tables" (this phase's own instruction): there is nothing
 * here worth persisting that isn't already saved by an earlier phase.
 */

export type PreviewSourcePhase = 'intelligence' | 'blueprint' | 'content' | 'impact'

export interface PreviewSection {
  id: string
  label: string
  value: string
  sourcePhase: PreviewSourcePhase
  /** False for Intelligence-sourced sections — those are edited on their own dedicated page (Proposal Intelligence / Smart Questions) via "Go Back", never regenerated here, since no generation endpoint exists for a single Intelligence field in isolation. */
  canRegenerate: boolean
}

export type PreviewSectionDecision = 'pending' | 'approved' | 'skipped'
