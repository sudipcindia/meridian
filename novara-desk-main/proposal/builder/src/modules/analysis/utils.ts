/**
 * Trims each list-field item and drops blank ones — applied only at Save
 * time, so free typing in a list field (blank lines, in-progress entries)
 * is never fought during editing. Shared by every AI Analysis phase that
 * edits a record with string/string[] fields (TranscriptAnalysisFields,
 * ProposalData).
 */
export function cleanListFields<T extends object>(obj: T): T {
  const cleaned = { ...obj } as Record<string, unknown>
  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]
    if (Array.isArray(value)) {
      cleaned[key] = value.map((v) => String(v).trim()).filter(Boolean)
    }
  }
  return cleaned as T
}
