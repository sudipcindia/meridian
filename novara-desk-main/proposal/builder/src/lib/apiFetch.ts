import { supabase } from './supabaseClient.js'

const DEFAULT_TIMEOUT_MS = 60_000

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number
  /** Attaches the current Supabase session's access token — required for staff-only endpoints (see api/_lib/auth/requireStaffAuth.ts). */
  authenticated?: boolean
}

/**
 * Thin wrapper used for every call this app makes to its own /api/*
 * endpoints. Two things plain fetch() doesn't give you for free:
 *  - a client-side timeout, so a stalled connection doesn't leave a
 *    "Sending…"/"Generating…" button spinning forever;
 *  - attaching the current Supabase session's access token when
 *    `authenticated: true`, since RLS alone doesn't protect staff-only
 *    endpoints (they run under the service-role key) — the server side
 *    verifies this same token via requireStaffAuth().
 */
export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, authenticated, headers, ...rest } = options

  const finalHeaders = new Headers(headers)
  if (authenticated) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) {
      finalHeaders.set('Authorization', `Bearer ${data.session.access_token}`)
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...rest, headers: finalHeaders, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // eslint-disable-next-line preserve-caught-error -- ErrorOptions/`cause` needs an ES2022 lib target; this app is pinned to ES2020, and widening it for one line isn't worth the risk of changing type-checking behavior elsewhere.
      throw new Error('Request timed out — please check your connection and try again')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
