import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack, Search } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ProposalTable } from '../components/ProposalTable.js'
import { EmptyState } from '../components/EmptyState.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { CreateProposalModal } from '../components/CreateProposalModal.js'
import { useProposals } from '../hooks/useProposals.js'
import { createProposal, deleteProposal, duplicateProposal } from '../lib/proposals.js'
import { SIMPLE_STATUSES, SIMPLE_STATUS_LABELS, toSimpleStatus, type SimpleStatus } from '../modules/status/simpleStatus.js'

type FilterValue = 'all' | SimpleStatus

/**
 * The one Proposal Dashboard: New Proposal, Search, Filters, List — this
 * is the whole "Sales/Ops/Management should be able to create, open,
 * review, send, and track a proposal within seconds" brief. Replaces the
 * previous Dashboard + Proposals + Drafts + Archived split (4 separate
 * nav items, no search, no filter toggle) with one searchable/filterable
 * list. Archived proposals are hidden unless the Archived filter is
 * explicitly selected — same convention the old pages already used.
 */
export function Dashboard() {
  const navigate = useNavigate()
  const { proposals, loading, error: loadError, reload } = useProposals()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const error = actionError || loadError

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return proposals.filter((p) => {
      const simple = toSimpleStatus(p.status)
      if (filter === 'all' ? simple === 'archived' : simple !== filter) return false
      if (!q) return true
      return (
        p.clientName.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        p.proposalName.toLowerCase().includes(q)
      )
    })
  }, [proposals, search, filter])

  async function handleDuplicate(id: string) {
    try {
      await duplicateProposal(id)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate proposal')
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteProposal(pendingDeleteId)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete proposal')
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const deletingProposal = proposals.find((p) => p.id === pendingDeleteId)

  return (
    <>
      <Topbar title="Dashboard" subtitle="Every client proposal, in one place" onNewProposal={() => setShowCreate(true)} />

      <div className="px-8 py-6 flex flex-col gap-5">
        {error && <ErrorBanner message={error} />}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-novara-light/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, company, or proposal name…"
              className="w-full bg-white/5 border border-novara-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-general-sans placeholder:text-novara-light/30 focus:outline-none focus:border-novara-teal/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-general-sans font-medium border transition-colors ${
                filter === 'all'
                  ? 'bg-novara-teal/15 text-novara-teal border-novara-teal/25'
                  : 'text-novara-light/60 border-novara-border hover:text-white'
              }`}
            >
              All
            </button>
            {SIMPLE_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-general-sans font-medium border transition-colors ${
                  filter === s
                    ? 'bg-novara-teal/15 text-novara-teal border-novara-teal/25'
                    : 'text-novara-light/60 border-novara-border hover:text-white'
                }`}
              >
                {SIMPLE_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={FileStack}
            title={proposals.length === 0 ? 'No proposals yet' : 'No matching proposals'}
            description={
              proposals.length === 0
                ? 'Create your first client proposal from the Master Template.'
                : 'Try a different search term or filter.'
            }
            action={proposals.length === 0 ? { label: 'Create Proposal', onClick: () => setShowCreate(true) } : undefined}
          />
        )}

        {filtered.length > 0 && (
          <ProposalTable proposals={filtered} onDuplicate={handleDuplicate} onDelete={setPendingDeleteId} />
        )}
      </div>

      {showCreate && (
        <CreateProposalModal
          onClose={() => setShowCreate(false)}
          onCreate={async (input, method) => {
            const proposal = await createProposal(input)
            reload()
            navigate(method === 'manual' ? `/proposals/${proposal.id}/edit` : `/proposals/${proposal.id}/intelligence?flow=meetingTranscript`)
          }}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete Proposal"
          message={`This will permanently delete "${deletingProposal?.proposalName ?? 'this proposal'}" and everything attached to it (document, versions, notes, acceptance record). This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Permanently'}
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  )
}
