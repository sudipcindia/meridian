import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'

/**
 * Gates every staff-facing route behind a real Supabase Auth session +
 * team_members membership. Never wraps /p/:token (client link) or
 * /proposals/:id/pdf-view (headless Chromium, no session possible) — both
 * stay outside this component in App.tsx.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, authorised, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novara-dark">
        <span className="text-[13px] font-general-sans text-novara-light/50">Loading…</span>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (authorised === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novara-dark px-6 text-center">
        <span className="text-[14px] font-general-sans text-novara-light/70">
          This account isn't authorised for Proposal Builder access.
        </span>
      </div>
    )
  }

  // authorised === null briefly while the team_members check is in flight.
  if (authorised === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novara-dark">
        <span className="text-[13px] font-general-sans text-novara-light/50">Checking access…</span>
      </div>
    )
  }

  return <>{children}</>
}
