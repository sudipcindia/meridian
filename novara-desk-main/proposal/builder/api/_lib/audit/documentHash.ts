import { createHash } from 'node:crypto'
import { canonicalize } from '../../../src/modules/audit/canonicalize.js'

/** The exact shape hashed on both sides of the comparison — see src/lib/documentHash.ts's browser counterpart. Key names (camelCase contentOverrides, not the DB column name) must match exactly, since the browser side builds this same shape from `getDocumentByProposalId()`'s already-camelCased `ProposalDocument`. */
export interface HashableDocumentContent {
  pages: unknown
  variables: unknown
  contentOverrides: unknown
}

export function computeDocumentHash(content: HashableDocumentContent): string {
  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex')
}
