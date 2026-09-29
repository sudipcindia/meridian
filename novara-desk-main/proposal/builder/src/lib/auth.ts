import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient.js'

/** Sends a magic link to the given email — no password ever exists in this app. */
export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Consumes a one-time session handoff from Ops Intel's iframe embed
 * (`oiOpenProposalEditor` in the main app's index.html) — this app runs on a
 * different origin, so a Novara Desk session can't be picked up any other
 * way even though both apps share the same Supabase project. The token pair
 * arrives as a URL hash fragment (never sent to any server); once consumed,
 * the hash is stripped immediately so it never lingers in history/URL bars.
 * A no-op when the app is opened directly (no hash present) — the normal
 * magic-link login flow in that case is unaffected.
 */
export async function consumeHandoffSession(): Promise<void> {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const params = new URLSearchParams(raw)
  const accessToken = params.get('nd_at')
  const refreshToken = params.get('nd_rt')
  if (!accessToken || !refreshToken) return
  try {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  } finally {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => subscription.unsubscribe()
}

/**
 * "Authorised Novara user" = has a row in `team_members` under this email
 * — the same source of truth the new staff-only RLS policies check
 * (auth.jwt()->>'email' IN (SELECT email FROM team_members)), so this is a
 * UX-layer convenience check, not the real security boundary (RLS is).
 */
export async function isAuthorisedTeamMember(email: string): Promise<boolean> {
  // Escape ilike's wildcard characters — `email` comes from the verified
  // Supabase Auth session, but %/_ are technically legal in an email's
  // local part, and this should never accidentally match more than one
  // exact address.
  const escaped = email.replace(/[%_]/g, (c) => `\\${c}`)
  const { data, error } = await supabase.from('team_members').select('id').ilike('email', escaped).maybeSingle()

  if (error) throw error
  return Boolean(data)
}
