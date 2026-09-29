import { supabase } from './supabaseClient.js'
import { computeViewAnalytics, type ProposalView, type ViewAnalytics } from '../modules/audit/viewAnalytics.js'

export { computeViewAnalytics, type ProposalView, type ViewAnalytics }

const TABLE = 'proposal_builder_views'

interface ViewRow {
  id: string
  session_id: string
  ip_address: string | null
  user_agent: string | null
  geo_country: string | null
  geo_region: string | null
  geo_city: string | null
  viewed_at: string
  duration_ms: number | null
}

function toView(row: ViewRow): ProposalView {
  return {
    id: row.id,
    sessionId: row.session_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    geoCountry: row.geo_country,
    geoRegion: row.geo_region,
    geoCity: row.geo_city,
    viewedAt: row.viewed_at,
    durationMs: row.duration_ms,
  }
}

/** Every recorded view for a proposal, newest first — the raw feed behind ViewAnalyticsCard's stats and recent-views list. Staff-side (anon-key client, RLS-gated) — the server-side equivalent (api/_lib/pdf/auditReportAdapter.ts) queries the same table via supabaseServer instead. */
export async function listViews(proposalId: string): Promise<ProposalView[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, session_id, ip_address, user_agent, geo_country, geo_region, geo_city, viewed_at, duration_ms')
    .eq('proposal_id', proposalId)
    .order('viewed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as ViewRow[]).map(toView)
}
