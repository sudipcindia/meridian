// Server-side (service-role) activity logging — inserts into
// proposal_builder_activity, the single table serving both the "Activity
// Timeline" and "Audit Trail" requirements (append-only, never
// overwritten). Best-effort: a logging failure must never break the
// primary action it's attached to.

import { supabaseServer } from '../supabaseServerClient.js'

export interface LogActivityInput {
  proposalId: string
  action: string
  actor: string
  actorName?: string
  detail?: string
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await supabaseServer.from('proposal_builder_activity').insert({
      proposal_id: input.proposalId,
      action: input.action,
      actor: input.actor,
      actor_name: input.actorName ?? null,
      detail: input.detail ?? null,
    })
  } catch {
    // Never throw — activity logging must never break the caller's primary action.
  }
}

/**
 * Logs a 'viewed' activity at most once per 10 minutes per proposal, so
 * repeated page reloads/opens by the client don't spam the timeline.
 */
export async function logViewedDebounced(proposalId: string): Promise<void> {
  try {
    const { data: recent } = await supabaseServer
      .from('proposal_builder_activity')
      .select('action, created_at')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent?.action === 'viewed') {
      const ageMs = Date.now() - new Date(recent.created_at).getTime()
      if (ageMs < 10 * 60 * 1000) return
    }

    await logActivity({ proposalId, action: 'viewed', actor: 'client' })
  } catch {
    // Best-effort — never break the client's proposal load.
  }
}
