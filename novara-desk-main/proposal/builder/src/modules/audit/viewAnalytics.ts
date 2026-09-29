/**
 * Pure, isomorphic view-analytics derivation — no Supabase import, so it's
 * safe to use from both src/lib/views.ts (browser, anon-key client) and
 * api/_lib/pdf/auditReportAdapter.ts (server, service-role client). Each
 * side fetches proposal_builder_views rows its own way and maps them into
 * ProposalView before calling computeViewAnalytics — the derivation logic
 * itself is written once.
 */
export interface ProposalView {
  id: string
  sessionId: string
  ipAddress: string | null
  userAgent: string | null
  geoCountry: string | null
  geoRegion: string | null
  geoCity: string | null
  viewedAt: string
  durationMs: number | null
}

export interface ViewAnalytics {
  totalViews: number
  firstViewedAt: string | null
  lastViewedAt: string | null
  sessionCount: number
  /** null when no view has a recorded duration yet — never presented as "0". */
  averageDurationMs: number | null
  /** null when the proposal isn't signed yet. */
  visitsBeforeSigning: number | null
}

/** Derives the audit trail's "View & Session Analytics" numbers from the raw view feed. */
export function computeViewAnalytics(views: ProposalView[], acceptedAt: string | null): ViewAnalytics {
  if (views.length === 0) {
    return { totalViews: 0, firstViewedAt: null, lastViewedAt: null, sessionCount: 0, averageDurationMs: null, visitsBeforeSigning: acceptedAt ? 0 : null }
  }
  const sortedAsc = [...views].sort((a, b) => new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime())
  const sessionCount = new Set(views.map((v) => v.sessionId)).size
  const durations = views.map((v) => v.durationMs).filter((d): d is number => d !== null && d > 0)
  const averageDurationMs = durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : null
  const visitsBeforeSigning = acceptedAt
    ? views.filter((v) => new Date(v.viewedAt).getTime() < new Date(acceptedAt).getTime()).length
    : null

  return {
    totalViews: views.length,
    firstViewedAt: sortedAsc[0].viewedAt,
    lastViewedAt: sortedAsc[sortedAsc.length - 1].viewedAt,
    sessionCount,
    averageDurationMs,
    visitsBeforeSigning,
  }
}
