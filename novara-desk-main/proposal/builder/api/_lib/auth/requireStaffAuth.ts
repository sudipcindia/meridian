// Server-side counterpart to ProtectedRoute.tsx's client-side gate.
// Every staff-triggered Vercel function (AI assist, PDF generation,
// send-to-client) must call this before doing any work. Table RLS alone
// does NOT protect these routes — they all run under the service-role
// key (supabaseServer), which bypasses RLS entirely — so without this
// check, anyone who knows or guesses a proposalId could trigger these
// actions with no session at all. This verifies the Supabase Auth JWT the
// browser attaches (see src/lib/apiFetch.ts) against team_members using
// the service-role key, which is a real security boundary.

import { supabaseServer, isSupabaseConfigured } from '../supabaseServerClient.js'

export class StaffAuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (c) => `\\${c}`)
}

export async function requireStaffAuth(req: RequestLike): Promise<{ email: string }> {
  // Checked explicitly (rather than letting the query below fail) so a missing
  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY surfaces as its own clear, specific
  // 500 error — not the accurate-sounding-but-wrong "Invalid or expired
  // session" a generic auth-lookup failure below would otherwise produce.
  if (!isSupabaseConfigured) {
    console.error('requireStaffAuth: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
    throw new StaffAuthError(500, 'Server misconfiguration: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
  }

  const authHeader = req.headers?.authorization
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader
  const token = headerValue?.startsWith('Bearer ') ? headerValue.slice(7) : undefined
  if (!token) throw new StaffAuthError(401, 'Missing or invalid Authorization header')

  const { data, error } = await supabaseServer.auth.getUser(token)
  if (error || !data.user?.email) throw new StaffAuthError(401, 'Invalid or expired session')

  const email = data.user.email
  const { data: member, error: memberError } = await supabaseServer
    .from('team_members')
    .select('id')
    .ilike('email', escapeIlike(email))
    .maybeSingle()

  if (memberError || !member) throw new StaffAuthError(403, 'Not an authorised Novara user')

  return { email }
}
