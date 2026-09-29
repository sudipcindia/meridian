import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { getDocumentByProposalId } from '../../lib/documents.js'
import { computeDocumentHash } from '../../lib/documentHash.js'
import { formatUkDateTime } from '../../lib/formatDateUk.js'
import type { Acceptance } from '../../lib/acceptances.js'

interface DocumentIntegrityBannerProps {
  proposalId: string
  acceptance: Acceptance
}

type IntegrityState = 'checking' | 'unchanged' | 'modified' | 'unavailable' | 'error'

/**
 * Answers the single most legally important question on this page: is the
 * document a client signed still the document they'd see today? Fetches
 * the CURRENT document via the same staff-side read every other page
 * already uses (getDocumentByProposalId — no new endpoint), re-hashes it
 * client-side with the same canonical algorithm the server used at accept
 * time (see api/_lib/audit/documentHash.ts's doc comment), and compares.
 *
 * `acceptance.documentHash` is null for any acceptance recorded before
 * this feature existed — that case must read as "unavailable," never as
 * a false "unchanged" (which would be worse than saying nothing).
 */
export function DocumentIntegrityBanner({ proposalId, acceptance }: DocumentIntegrityBannerProps) {
  const [state, setState] = useState<IntegrityState>(acceptance.documentHash ? 'checking' : 'unavailable')

  useEffect(() => {
    if (!acceptance.documentHash) {
      setState('unavailable')
      return
    }
    let cancelled = false
    setState('checking')
    getDocumentByProposalId(proposalId)
      .then(async (document) => {
        if (cancelled) return
        if (!document) {
          setState('error')
          return
        }
        const currentHash = await computeDocumentHash({
          pages: document.pages,
          variables: document.variables,
          contentOverrides: document.contentOverrides,
        })
        if (cancelled) return
        setState(currentHash === acceptance.documentHash ? 'unchanged' : 'modified')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [proposalId, acceptance.documentHash])

  const acceptedAtText = formatUkDateTime(acceptance.acceptedAt)

  if (state === 'checking') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-novara-border bg-white/[0.02] px-4 py-3 text-[13px] font-general-sans text-novara-light/50">
        <ShieldQuestion size={16} className="shrink-0" /> Checking document integrity…
      </div>
    )
  }

  if (state === 'unchanged') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-novara-teal/30 bg-novara-teal/10 px-4 py-3 text-[13px] font-general-sans text-novara-teal">
        <ShieldCheck size={16} className="shrink-0" />
        Content unchanged since signing on {acceptedAtText} — this signature is valid for the current document.
      </div>
    )
  }

  if (state === 'modified') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-[13px] font-general-sans text-red-300">
        <ShieldAlert size={16} className="shrink-0" />
        Modified after signing on {acceptedAtText} — this signature is no longer valid for the current version of this document.
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-novara-border bg-white/[0.02] px-4 py-3 text-[13px] font-general-sans text-novara-light/50">
        <ShieldQuestion size={16} className="shrink-0" />
        Integrity check unavailable — this signature was recorded before document-hash verification existed.
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-novara-border bg-white/[0.02] px-4 py-3 text-[13px] font-general-sans text-novara-light/50">
      <ShieldQuestion size={16} className="shrink-0" /> Could not check document integrity right now.
    </div>
  )
}
