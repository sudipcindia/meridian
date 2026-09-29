import { STATUS_LABELS, type ProposalStatus } from '../types/proposal.js'

const STATUS_STYLES: Record<ProposalStatus, string> = {
  draft: 'bg-white/8 text-novara-light/70 border-white/10',
  internal_review: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
  changes_requested: 'bg-orange-400/10 text-orange-300 border-orange-400/25',
  approved: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  rejected: 'bg-red-400/10 text-red-300 border-red-400/25',
  ready_for_pdf: 'bg-novara-orange/10 text-novara-orange border-novara-orange/25',
  ready: 'bg-novara-teal/10 text-novara-teal border-novara-teal/25',
  sent: 'bg-blue-400/10 text-blue-300 border-blue-400/25',
  signed: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  archived: 'bg-white/5 text-novara-light/40 border-white/10',
}

export function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
