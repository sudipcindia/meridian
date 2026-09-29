import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surfaced in the UI via ProposalList/Dashboard error states rather than
  // thrown here, so the app shell still renders without credentials.
  console.warn(
    'Supabase credentials missing. Copy .env.example to .env.local and fill in ' +
      'the same Supabase project used by the main Novara Desk app.'
  )
}

/**
 * This app is opened both directly and embedded in a cross-origin iframe
 * from Ops Intel — some browsers (Safari ITP, Chrome with third-party
 * cookies/storage blocked) throw a SecurityError just from *touching*
 * `window.localStorage` inside a third-party iframe. supabase-js's default
 * storage reads/writes localStorage as part of session init, so that throw
 * would otherwise crash the whole app before anything renders. Falling back
 * to an in-memory store is an acceptable tradeoff here: the session doesn't
 * need to survive a reload inside the iframe anyway, since Ops Intel hands
 * off a fresh one (see oiOpenProposalEditor/consumeHandoffSession) every
 * time the editor is opened.
 */
function createSafeStorage(): Storage {
  try {
    const testKey = '__novara_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: (key) => {
        memory.delete(key)
      },
      clear: () => memory.clear(),
      key: (index) => Array.from(memory.keys())[index] ?? null,
      get length() {
        return memory.size
      },
    }
  }
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { storage: createSafeStorage() },
})
