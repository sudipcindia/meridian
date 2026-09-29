import { Plus } from 'lucide-react'

interface TopbarProps {
  title: string
  subtitle?: string
  onNewProposal?: () => void
}

export function Topbar({ title, subtitle, onNewProposal }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-novara-border">
      <div>
        <h1 className="font-clash-display text-[24px] text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="font-general-sans text-[13px] text-novara-light/60 mt-1">{subtitle}</p>
        )}
      </div>

      {onNewProposal && (
        <button
          onClick={onNewProposal}
          className="flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Proposal
        </button>
      )}
    </header>
  )
}
