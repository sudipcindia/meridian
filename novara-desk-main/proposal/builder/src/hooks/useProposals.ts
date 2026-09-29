import { useCallback, useEffect, useState } from 'react'
import { listProposals } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

interface UseProposalsResult {
  proposals: Proposal[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** Loads all proposals once and exposes a manual reload for after mutations. */
export function useProposals(): UseProposalsResult {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listProposals()
      .then((data) => {
        if (!cancelled) setProposals(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load proposals')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [version])

  return { proposals, loading, error, reload }
}
