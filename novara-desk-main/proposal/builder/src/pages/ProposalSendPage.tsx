import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { ProposalTabs } from '../components/ProposalTabs.js'
import { SendToClientPanel } from '../components/client/SendToClientPanel.js'
import { GeneratePdfButton } from '../components/pdf/GeneratePdfButton.js'
import { PDF_VIEWABLE_STATUSES } from '../modules/status/gates.js'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

/**
 * Send tab — split out of the Review page so "Review" and "Send" are two
 * distinct, simple stops (per the Dashboard simplification brief). Same
 * SendToClientPanel/GeneratePdfButton as before, unmoved in behaviour —
 * only which tab they live on changed. Email/eSign/Acceptance code paths
 * are untouched.
 */
export function ProposalSendPage() {
  const { id } = useParams<{ id: string }>()

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
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (error) return <div className="px-8 py-6"><ErrorBanner message={error} /></div>
  if (!proposal) return null

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Send the secure client link and view export options" />
      <div className="px-8"><ProposalTabs proposalId={id} /></div>

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <SendToClientPanel proposal={proposal} onSent={setProposal} />

        {/* Novara: the primary workflow is the secure web proposal above, not
            PDF — a client is never expected to download/sign/return a PDF.
            Generate PDF stays an internal utility only, surfaced once
            there's something worth archiving/exporting (signed, or already
            archived) rather than as a step in the normal create→send flow.
            This gate is unchanged for Novara proposals.

            Upwork: these are normally sent to the client as a PDF over
            WhatsApp instead of going through the e-sign flow above, so a
            proposal may never reach "signed" — the button is surfaced as
            soon as the proposal is otherwise exportable (the same
            PDF_VIEWABLE_STATUSES gate api/pdf/generate.ts itself enforces),
            not gated behind signed/archived. */}
        {proposal.providerIdentity === 'upwork'
          ? PDF_VIEWABLE_STATUSES.includes(proposal.status) && <GeneratePdfButton proposal={proposal} />
          : (proposal.status === 'signed' || proposal.status === 'archived') && <GeneratePdfButton proposal={proposal} />}
      </div>
    </>
  )
}
