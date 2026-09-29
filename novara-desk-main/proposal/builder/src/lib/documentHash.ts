import { canonicalize } from '../modules/audit/canonicalize.js'

/** Mirrors api/_lib/audit/documentHash.ts's HashableDocumentContent exactly — same field names, same shape, so identical documents hash identically regardless of which runtime computed it. */
export interface HashableDocumentContent {
  pages: unknown
  variables: unknown
  contentOverrides: unknown
}

/** Browser-side SHA-256 via the Web Crypto API (crypto.subtle) — async, unlike the Node wrapper's synchronous createHash, since subtle.digest always returns a Promise. */
export async function computeDocumentHash(content: HashableDocumentContent): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(content))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
