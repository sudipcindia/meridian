import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Icon size={22} strokeWidth={1.5} className="text-novara-light/50" />
      </div>
      <p className="font-clash-display text-white text-[17px] mb-1.5">{title}</p>
      <p className="font-general-sans text-novara-light/50 text-[13px] max-w-[360px] mb-5">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
