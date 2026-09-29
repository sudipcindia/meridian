import { supabase } from './supabaseClient.js'

const TABLE = 'proposal_builder_activity'

export interface ActivityEntry {
  id: string
  action: string
  actor: string
  actorName: string | null
  detail: string | null
  createdAt: string
}

interface ActivityRow {
  id: string
  action: string
  actor: string
  actor_name: string | null
  detail: string | null
  created_at: string
}

function fromRow(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    actorName: row.actor_name,
    detail: row.detail,
    createdAt: row.created_at,
  }
}

/**
 * Read side of the existing write-only activity log (see
 * modules/activity/logActivity.ts and api/_lib/activity/logActivity.ts) —
 * this is the first place any of it is actually displayed. Newest first,
 * so the most recent thing that happened to a proposal is always at the
 * top of its Activity tab.
 */
export async function listActivity(proposalId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, action, actor, actor_name, detail, created_at')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(fromRow)
}
