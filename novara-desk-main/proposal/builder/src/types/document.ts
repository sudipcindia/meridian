import type { TemplatePageId } from '../masterTemplate/index.js'
import type { ContentOverrideMap, VariableMap } from '../modules/variables/index.js'

/**
 * A Document is one proposal's actual content instance — always a
 * duplicated copy derived from the master template, never the template
 * itself. Kept separate from `Proposal` (metadata) so future modules
 * (Variable Engine, PDF Export, Version History) can operate on content
 * without touching client/status/ownership metadata.
 */
export interface ProposalDocument {
  id: string
  proposalId: string

  /** Which version of the (single, frozen) master template this was created from. */
  masterTemplateVersion: number

  /** This document's own revision number — bumps as the client's content is edited/saved. */
  documentVersion: number

  /** Which of the 11 master template pages this document includes. */
  pages: TemplatePageId[]

  /**
   * Values for the master template's existing bracket placeholders (see
   * `modules/variables`), keyed by canonical variable key — never by the
   * literal "[Client Name]"-style token. Seeded from Proposal metadata on
   * creation; the future Proposal Editor will let staff edit it directly.
   */
  variables: VariableMap

  /**
   * Free-text overrides for generic content blocks (see
   * `modules/variables/contentBlocks`), keyed by block key — this is the
   * Proposal Editor's "edit any rendered text" surface, distinct from the
   * known bracket-placeholder variables above. Empty until Phase 03's
   * editor is used to change something.
   */
  contentOverrides: ContentOverrideMap

  createdDate: string
  updatedDate: string
}
