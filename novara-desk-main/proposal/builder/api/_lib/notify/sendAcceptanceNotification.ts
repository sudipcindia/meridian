// A separate, direct email — distinct from notifyTeam.ts's existing
// notifications-table mechanism (which resolves recipients dynamically from
// team_members and already emails "Jayson Kandiah" by name-match). This one
// is sent to a fixed recipient list via the existing Resend wrapper, kept
// independent of team_members so it can't silently drift as staff change.
// notifyTeam.ts is untouched and keeps firing exactly as it does today;
// this is purely additive.

import { sendEmail } from '../email/sendEmail.js'

const RECIPIENTS = ['vvishwakarma@novaraconsult.co.uk', 'j@novaraconsult.co.uk']

export interface AcceptanceNotificationInput {
  proposalName: string
  clientName: string
  companyName: string
  signerName: string
  email: string
  phone: string
  acceptedAt: string
  proposalLink: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-family:sans-serif;font-size:14px;">${label}</td><td style="padding:4px 0;font-family:sans-serif;font-size:14px;color:#0D1A1F;">${escapeHtml(value)}</td></tr>`
}

export async function sendAcceptanceNotification(input: AcceptanceNotificationInput): Promise<void> {
  const acceptedDate = `${new Date(input.acceptedAt).toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  })} UK time`

  const html = `
    <div style="font-family: sans-serif; color: #0D1A1F; max-width: 480px;">
      <h2 style="margin: 0 0 16px; font-family: sans-serif;">Proposal Accepted</h2>
      <table style="border-collapse: collapse;">
        ${row('Proposal Name', input.proposalName)}
        ${row('Client', input.clientName)}
        ${row('Company', input.companyName)}
        ${row('Accepted By', input.signerName)}
        ${row('Email', input.email)}
        ${row('Phone', input.phone)}
        ${row('Accepted Date', acceptedDate)}
      </table>
      <p style="margin-top: 20px; font-family: sans-serif;">
        <a href="${input.proposalLink}" style="color: #FF5B04;">View Proposal</a>
      </p>
    </div>
  `.trim()

  await sendEmail({ to: RECIPIENTS, subject: 'Proposal Accepted', html })
}
