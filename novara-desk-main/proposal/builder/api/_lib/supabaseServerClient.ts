// Server-side Supabase client for Vercel functions. Cannot reuse
// src/lib/supabaseClient.ts (that one reads import.meta.env, a Vite-only
// build-time mechanism that doesn't exist in a plain Node function runtime)
// — this mirrors the existing api/portal/_lib.js pattern instead: secrets
// read only via process.env, service-role key so storage/table writes
// bypass RLS entirely (same as that file's approach), never exposed to
// the client.
//
// Env vars required (set in Vercel dashboard for this project):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** Every server route should check this before trusting a query against `supabaseServer` — see requireStaffAuth.ts for the pattern. */
export const isSupabaseConfigured = Boolean(url && serviceRoleKey)

if (!isSupabaseConfigured) {
  console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — every server-side Supabase call will fail until configured.')
}

// createClient() throws SYNCHRONOUSLY when given an empty/invalid URL
// ("supabaseUrl is required.") — since this file is evaluated once at
// module-import time, that throw would crash this module before any
// route's own try/catch even runs, producing an opaque platform error
// page instead of a clean JSON response (this was the actual root cause
// of a real production 500 on every staff-gated route when these env
// vars were unset). A syntactically-valid placeholder keeps construction
// itself safe in that case; `isSupabaseConfigured` is what callers check
// to fail with a clear, diagnosable error instead.
export const supabaseServer = createClient(url || 'https://placeholder.supabase.co', serviceRoleKey || 'placeholder-service-role-key')
