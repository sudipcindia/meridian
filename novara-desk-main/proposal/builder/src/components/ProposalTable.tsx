import { Copy, Trash2, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SimpleStatusBadge } from './SimpleStatusBadge.js'
import { ProviderIdentityBadge } from './ProviderIdentityBadge.js'
import { toSimpleStatus } from '../modules/status/simpleStatus.js'
import { formatDateOnly } from '../lib/formatDate.js'
import type { Proposal } from '../types/proposal.js'

interface ProposalTableProps {
  proposals: Proposal[]
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

/**
 * Simplified per the Dashboard brief: exactly Proposal Name, Client Name,
 * Company, Prepared By, Type, Status, Last Updated, plus Open (row click)/
 * Duplicate/Delete/Send-when-Ready quick actions. No version number, no
 * Archive/Restore row actions (those stay on the Overview tab) — this
 * table is the whole "developer info" trim the brief asked for. Type
 * (Novara vs Upwork) was added back deliberately — with Upwork proposals
 * now able to look visually identical to Novara ones until opened, this is
 * the one place staff can tell them apart without clicking in.
 */
export function ProposalTable({ proposals, onDuplicate, onDelete }: ProposalTableProps) {
  const navigate = useNavigate()

  return (
    <div className="border border-novara-border rounded-xl overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.03] border-b border-novara-border">
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Proposal
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Client
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Company
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Prepared By
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Type
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Status
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Updated
            </th>
            <th className="px-5 py-3 text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => (
            <tr
              key={p.id}
              className="border-b border-novara-border last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
              onClick={() => navigate(`/proposals/${p.id}`)}
            >
              <td className="px-5 py-4">
                <p className="text-sm font-general-sans font-medium text-white">{p.proposalName}</p>
              </td>
              <td className="px-5 py-4 text-sm font-general-sans text-novara-light/80">{p.clientName}</td>
              <td className="px-5 py-4 text-sm font-general-sans text-novara-light/80">{p.companyName}</td>
              <td className="px-5 py-4 text-sm font-general-sans text-novara-light/60">{p.preparedBy}</td>
              <td className="px-5 py-4">
                <ProviderIdentityBadge providerIdentity={p.providerIdentity} />
              </td>
              <td className="px-5 py-4">
                <SimpleStatusBadge status={p.status} />
              </td>
              <td className="px-5 py-4 text-sm font-general-sans text-novara-light/60">
                {formatDateOnly(p.updatedDate)}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {toSimpleStatus(p.status) === 'ready' && (
                    <button
                      onClick={() => navigate(`/proposals/${p.id}/send`)}
                      title="Send"
                      className="p-2 rounded-lg text-novara-light/50 hover:text-novara-orange hover:bg-novara-orange/10 transition-colors"
                    >
                      <Send size={15} strokeWidth={1.75} />
                    </button>
                  )}
                  <button
                    onClick={() => onDuplicate(p.id)}
                    title="Duplicate"
                    className="p-2 rounded-lg text-novara-light/50 hover:text-novara-teal hover:bg-novara-teal/10 transition-colors"
                  >
                    <Copy size={15} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-novara-light/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
