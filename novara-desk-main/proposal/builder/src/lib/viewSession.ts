const SESSION_STORAGE_KEY = 'novara_proposal_view_session'

/**
 * One id per browser tab session (sessionStorage, not localStorage — a new
 * tab or a closed-then-reopened tab gets a fresh id, matching "session" in
 * the audit trail's "Number of Sessions" sense; reloading within the same
 * tab keeps the same id, which is what groups multiple page loads into one
 * session in proposal_builder_views). Falls back to a timestamp+random
 * string if sessionStorage or crypto.randomUUID are unavailable — never
 * throws, since this must never block a client from viewing/signing.
 */
export function getOrCreateViewSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    return id
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Best-effort "how long was this view open" report, sent via
 * navigator.sendBeacon so it can fire during page unload (a normal fetch
 * would be cancelled by the browser at that point). Fire-and-forget by
 * design — see api/client/resolve.ts's handleViewDuration doc comment on
 * why this is explicitly not a security boundary or a guaranteed-delivery
 * metric. Posts to the same route as the GET proposal-resolve endpoint
 * (method-branched) rather than its own file, to stay under Vercel Hobby's
 * 12-serverless-function-per-deployment cap.
 */
export function reportViewDuration(viewId: string, durationMs: number): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
    const payload = JSON.stringify({ viewId, durationMs })
    navigator.sendBeacon('/api/client/resolve', new Blob([payload], { type: 'application/json' }))
  } catch {
    // best-effort only — never throw during page unload
  }
}
