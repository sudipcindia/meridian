import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { consumeHandoffSession, getSession, isAuthorisedTeamMember, onAuthStateChange, signOut } from '../lib/auth.js'

interface AuthContextValue {
  session: Session | null
  /** null while still resolving, then true/false once the team_members check completes. */
  authorised: boolean | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authorised, setAuthorised] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAuthorisation(current: Session | null) {
      if (!current?.user.email) {
        if (!cancelled) setAuthorised(null)
        return
      }
      try {
        const ok = await isAuthorisedTeamMember(current.user.email)
        if (cancelled) return
        setAuthorised(ok)
        if (!ok) await signOut()
      } catch {
        if (!cancelled) setAuthorised(null)
      }
    }

    consumeHandoffSession()
      .catch(() => {})
      .then(() => getSession())
      .then(async (s) => {
        if (cancelled) return
        setSession(s)
        await checkAuthorisation(s)
      })
      .finally(() => !cancelled && setLoading(false))

    const unsubscribe = onAuthStateChange((s) => {
      setSession(s)
      void checkAuthorisation(s)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, authorised, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
