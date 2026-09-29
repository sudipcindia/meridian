// Vercel Serverless Function — generates (or returns a cached) PDF for an
// approved proposal. Env vars required (set in Vercel dashboard for this
// project): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see
// api/_lib/supabaseServerClient.ts). Optionally PUBLIC_BASE_URL if the
// deployment's own URL needs to be overridden; otherwise Vercel's own
// VERCEL_URL is used automatically.
//
// This handler is intentionally thin — all real logic lives in
// api/_lib/pdf/proposalPdfAdapter.ts (proposal PDF), api/_lib/pdf/auditReportAdapter.ts
// (audit report PDF, dispatched here via body.type === 'audit' rather than
// its own route — Vercel Hobby's 12-serverless-function-per-deployment cap
// was already fully used by this project) and api/_lib/pdf/engine.ts
// (generic, shared by both document types).

import { generateProposalPdf } from '../_lib/pdf/proposalPdfAdapter.js'
import { generateAuditReportPdf } from '../_lib/pdf/auditReportAdapter.js'
import { requireStaffAuth, StaffAuthError } from '../_lib/auth/requireStaffAuth.js'

interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  let staffEmail: string
  try {
    ;({ email: staffEmail } = await requireStaffAuth(req))
  } catch (e) {
    if (e instanceof StaffAuthError) return res.status(e.status).json({ error: e.message })
    throw e
  }

  const body = req.body as { proposalId?: string; type?: string }
  if (!body?.proposalId) {
    return res.status(400).json({ error: 'Missing required field: proposalId' })
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (!baseUrl) {
    return res.status(500).json({ error: 'Could not determine deployment URL (VERCEL_URL not set)' })
  }

  if (body.type === 'audit') {
    try {
      const result = await generateAuditReportPdf(body.proposalId, baseUrl, staffEmail)
      return res.status(200).json(result)
    } catch (e) {
      console.error('pdf/generate.ts (audit) error:', e instanceof Error ? e.message : e)
      return res.status(500).json({ error: 'Failed to generate audit report. Please try again.' })
    }
  }

  try {
    const result = await generateProposalPdf(body.proposalId, baseUrl)
    return res.status(200).json(result)
  } catch (e) {
    console.error('pdf/generate.ts error:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Failed to generate PDF. Please try again.' })
  }
}
