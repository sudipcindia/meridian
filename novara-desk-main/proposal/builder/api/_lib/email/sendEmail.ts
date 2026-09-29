// Thin Resend wrapper. Sends from novarapreview.com — the domain actually
// verified (SPF/DKIM) in this project's Resend account. novaraconsult.co.uk
// is NOT verified there, so sending "from" it was rejected outright by
// Resend's API; reply-to is kept on the real, monitored consultancy mailbox
// since reply-to doesn't require domain verification.
//
// Env var required (set in Vercel dashboard for this project): RESEND_API_KEY

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
// Same verified mailbox for every proposal — only the display name changes
// for the Upwork use case (Jayson personally, not "Novara Consult"). Sending
// from a different actual address would need a separately verified domain.
const FROM_MAILBOX = 'operations@novarapreview.com'
const REPLY_TO = 'desk+reply@novaraconsult.co.uk'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  /** Display name only — defaults to 'Novara Consult'. The mailbox itself never changes. */
  fromName?: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const r = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${input.fromName ?? 'Novara Consult'} <${FROM_MAILBOX}>`,
      reply_to: REPLY_TO,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!r.ok) {
    const data = await r.json().catch(() => ({}) as { message?: string; name?: string })
    throw new Error(data.message || data.name || `Resend API error ${r.status}`)
  }
}
