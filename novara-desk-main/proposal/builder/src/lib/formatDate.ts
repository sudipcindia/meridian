/** Date + time, e.g. "09 Jul 2026, 14:32" — used wherever a precise timestamp matters (review notes, revision history). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Date only, e.g. "09 Jul 2026" — used in list/table views where the time isn't needed. */
export function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
