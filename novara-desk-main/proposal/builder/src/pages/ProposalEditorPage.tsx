import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ProposalEditor } from '../components/editor/ProposalEditor.js'
import { useEffect, useState } from 'react'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'
import { ErrorBanner } from '../components/ErrorBanner.js'

export function ProposalEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getProposal(id)
      .then((p) => !cancelled && setProposal(p))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null

  return (
    <>
      <Topbar title={loading ? 'Loading…' : (proposal?.proposalName ?? 'Editor')} subtitle="Editing this proposal's own copy — the master template is never changed" />

      <div className="px-8 pt-4">
        <button
          onClick={() => navigate(`/proposals/${id}`)}
          className="flex items-center gap-1.5 text-[13px] font-general-sans text-novara-light/50 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back to Proposal
        </button>
      </div>

      {error && (
        <div className="px-8 py-6">
          <ErrorBanner message={error} />
        </div>
      )}

      {!loading && proposal && (
        <ProposalEditor
          proposalId={id}
          pages={proposal.pages}
          proposal={proposal}
          readOnly={proposal.status === 'signed'}
          onProposalUpdate={setProposal}
        />
      )}
    </>
  )
}
