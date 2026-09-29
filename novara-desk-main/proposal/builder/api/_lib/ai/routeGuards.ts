// Shared request-guard helpers — every AI route repeated these two exact
// blocks (the requireStaffAuth try/catch, and the ANTHROPIC_API_KEY
// presence check). Pure deduplication: same status codes, same error
// messages, same control flow as every route already had inline.

import { requireStaffAuth, StaffAuthError } from '../auth/requireStaffAuth.js'
import type { VercelRequest, VercelResponse } from './types.js'

/** Validates the staff session. On failure, writes the response itself and returns false — the caller should `if (!(await ensureStaffAuth(req, res))) return`. */
export async function ensureStaffAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  try {
    await requireStaffAuth(req)
    return true
  } catch (e) {
    if (e instanceof StaffAuthError) {
      res.status(e.status).json({ error: e.message })
      return false
    }
    throw e
  }
}

/** Reads ANTHROPIC_API_KEY. On failure, writes the response itself and returns null — the caller should `const apiKey = ensureAnthropicApiKey(res); if (!apiKey) return`. */
export function ensureAnthropicApiKey(res: VercelResponse): string | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set')
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
    return null
  }
  return apiKey
}
