// Browser-side (anon-key, authenticated staff session) activity logging —
// used by staff-driven events that happen entirely client-side (create,
// content save, AI suggestion applied, approval status change). Server-
// driven events (PDF generated, email sent, viewed, accepted) use the
// server counterpart at api/_lib/activity/logActivity.ts instead. Both
// insert into the same proposal_builder_activity table.

import { supabase } from '../../lib/supabaseClient.js'

export interface LogActivityInput {
  proposalId: string
  action: string
  actor: string
  actorName?: string
  detail?: string
}

/** Best-effort: a logging failure must never break the caller's primary action. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await supabase.from('proposal_builder_activity').insert({
      proposal_id: input.proposalId,
      action: input.action,
      actor: input.actor,
      actor_name: input.actorName ?? null,
      detail: input.detail ?? null,
    })
  } catch {
    // Swallowed deliberately.
  }
}
