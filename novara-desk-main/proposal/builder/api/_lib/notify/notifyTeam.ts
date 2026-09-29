// Notifies the internal team of a proposal acceptance via the main app's
// existing `notifications` table — an existing Supabase DB webhook on that
// table already auto-sends email (see index.html's pushNotification()
// comment: "Do NOT also call EDGE_FN_URL directly here: that causes
// duplicate emails"), so inserting a row here gives both an in-app bell
// notification AND an email for free, with zero new sending
// infrastructure. Recipients are resolved dynamically from `team_members`
// (department = Operations/Developer, plus Jayson by name — mirroring
// index.html's restrictedAreaAllowed() special case) rather than a flat
// env var, so this never drifts out of sync with staffing changes.

import { supabaseServer } from '../supabaseServerClient.js'

export interface NotifyTeamInput {
  proposalId: string
  proposalName: string
  clientName: string
  companyName: string
  signerName: string
  acceptedAt: string
}

interface TeamMemberRow {
  email: string
  name: string
}

export async function notifyTeam(input: NotifyTeamInput): Promise<void> {
  const { data: members, error } = await supabaseServer
    .from('team_members')
    .select('email, name, department')
    .or('department.eq.Operations,department.eq.Developer,name.ilike.Jayson Kandiah')

  if (error || !members || members.length === 0) return

  const title = `Proposal Accepted: ${input.proposalName}`
  const body = `${input.clientName} (${input.companyName}) has accepted "${input.proposalName}" — signed by ${input.signerName}.`

  await Promise.allSettled(
    (members as TeamMemberRow[]).map((member) =>
      supabaseServer.from('notifications').insert({
        user_email: member.email,
        type: 'proposal-accepted',
        title,
        body,
        ticket_id: null,
        ticket_title: null,
        triggered_by: 'system',
        read: false,
      })
    )
  )
}
