import { toSimpleStatus, SIMPLE_STATUS_LABELS, type SimpleStatus } from '../modules/status/simpleStatus.js'
import type { ProposalStatus } from '../types/proposal.js'

const SIMPLE_STATUS_STYLES: Record<SimpleStatus, string> = {
  draft: 'bg-white/8 text-novara-light/70 border-white/10',
  ready: 'bg-novara-teal/10 text-novara-teal border-novara-teal/25',
  sent: 'bg-blue-400/10 text-blue-300 border-blue-400/25',
  signed: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  archived: 'bg-white/5 text-novara-light/40 border-white/10',
}

/** Dashboard-only — shows the simplified 5-status vocabulary (see modules/status/simpleStatus.ts). The Review/Detail pages keep the full StatusBadge/raw status, unchanged. */
export function SimpleStatusBadge({ status }: { status: ProposalStatus }) {
  const simple = toSimpleStatus(status)
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${SIMPLE_STATUS_STYLES[simple]}`}
    >
      {SIMPLE_STATUS_LABELS[simple]}
    </span>
  )
}
