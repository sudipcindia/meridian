import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { listViews, computeViewAnalytics, type ProposalView } from '../../lib/views.js'
import { parseUserAgent } from '../../lib/acceptances.js'
import { formatUkDateTime, formatUkDateTimeShort } from '../../lib/formatDateUk.js'

interface ViewAnalyticsCardProps {
  proposalId: string
  /** null when the proposal hasn't been signed — "Visits Before Signing" then reads as not applicable rather than 0. */
  acceptedAt: string | null
}

const RECENT_VIEWS_LIMIT = 8

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-novara-border bg-white/[0.02] px-4 py-3">
      <span className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">{label}</span>
      <span className="text-[15px] font-general-sans font-medium text-white">{value}</span>
    </div>
  )
}

/**
 * Reads proposal_builder_views (see api/client/resolve.ts's write path) —
 * every real client-side page load, undebounced, distinct from the
 * human-readable Activity tab's 10-min-debounced 'viewed' event. Shown
 * whenever the proposal has been viewed at all, not gated on signed
 * status like the Signature Evidence card above it.
 */
export function ViewAnalyticsCard({ proposalId, acceptedAt }: ViewAnalyticsCardProps) {
  const [views, setViews] = useState<ProposalView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listViews(proposalId)
      .then((v) => !cancelled && setViews(v))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load view history'))
    return () => {
      cancelled = true
    }
  }, [proposalId])

  if (error) return null
  if (!views) return null
  if (views.length === 0) return null

  const stats = computeViewAnalytics(views, acceptedAt)

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-novara-light/50" />
        <p className="font-clash-display text-white text-[16px]">View &amp; Session Analytics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Total Views" value={String(stats.totalViews)} />
        <StatTile label="Sessions" value={String(stats.sessionCount)} />
        <StatTile
          label="Avg. Time Spent"
          value={stats.averageDurationMs !== null ? `~${formatDuration(stats.averageDurationMs)}` : 'Not enough data'}
        />
        <StatTile label="First Viewed" value={stats.firstViewedAt ? formatUkDateTimeShort(stats.firstViewedAt) : '—'} />
        <StatTile label="Last Viewed" value={stats.lastViewedAt ? formatUkDateTimeShort(stats.lastViewedAt) : '—'} />
        <StatTile label="Visits Before Signing" value={stats.visitsBeforeSigning !== null ? String(stats.visitsBeforeSigning) : 'Not yet signed'} />
      </div>

      <p className="text-[11px] font-general-sans text-novara-light/40">
        Time spent is approximate — a browser tab that's closed or backgrounded doesn't always report back.
      </p>

      <div className="flex flex-col gap-1 border-t border-novara-border pt-4">
        <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide mb-1">
          Recent Views
        </p>
        <div className="flex flex-col divide-y divide-novara-border">
          {views.slice(0, RECENT_VIEWS_LIMIT).map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 py-2 text-[12px] font-general-sans">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-white/90">{v.userAgent ? parseUserAgent(v.userAgent) : 'Unknown device'}</span>
                <span className="text-novara-light/40 truncate">
                  {v.ipAddress || 'IP not recorded'}
                  {(v.geoCity || v.geoCountry) && ` · ${[v.geoCity, v.geoCountry].filter(Boolean).join(', ')}`}
                </span>
              </div>
              <span className="text-novara-light/50 shrink-0" title={formatUkDateTime(v.viewedAt)}>
                {formatUkDateTimeShort(v.viewedAt)}
              </span>
            </div>
          ))}
        </div>
        {views.length > RECENT_VIEWS_LIMIT && (
          <p className="text-[11px] font-general-sans text-novara-light/40 pt-2">
            + {views.length - RECENT_VIEWS_LIMIT} more view{views.length - RECENT_VIEWS_LIMIT === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </div>
  )
}
