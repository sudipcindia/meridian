import { useState } from 'react'
import { signInWithMagicLink } from '../lib/auth.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'

/**
 * The Proposal Builder's own login — separate from index.html's, but the
 * same underlying Supabase Auth project, so a "team_members" email works
 * identically in both places. No password ever exists; only a magic link.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    try {
      await signInWithMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-in link')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-novara-dark px-6">
      <div className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="text-center">
          <p className="font-clash-display text-[22px] text-white tracking-tight">
            Novara <span className="text-novara-orange">Proposals</span>
          </p>
          <p className="text-[13px] font-general-sans text-novara-light/50 mt-1">Internal tool — Novara staff only</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-novara-border bg-white/5 p-6 text-center">
            <p className="text-[14px] font-general-sans text-white">Check your email</p>
            <p className="text-[13px] font-general-sans text-novara-light/60 mt-1">
              We sent a sign-in link to {email.trim()}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-novara-border bg-white/5 p-6 flex flex-col gap-4">
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
                Novara Email
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@novaraconsult.co.uk"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 text-novara-dark px-4 py-2.5 rounded-lg transition-colors"
            >
              {sending ? 'Sending…' : 'Send Sign-in Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
