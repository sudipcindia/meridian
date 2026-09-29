/**
 * The one place in the codebase that formats a timestamp in UK local time
 * regardless of the viewer's own browser timezone — extracted out of
 * ProposalDetail.tsx's inline formatting so the audit trail's several new
 * UK-timestamped sections (device/view history, activity timeline, the
 * downloadable audit report) can't drift into slightly different formats.
 * `timeZone: 'Europe/London'` correctly handles the GMT/BST transition —
 * it is NOT a fixed UTC+0/+1 offset.
 */
export function formatUkDateTime(iso: string): string {
  return `${new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  })} UK time`
}

/** Shorter variant for dense contexts (timeline rows, tables) — no "UK time" suffix, medium date style. */
export function formatUkDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  })
}
