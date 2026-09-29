import { NavLink } from 'react-router-dom'

interface ProposalTabsProps {
  proposalId: string
}

const TABS = [
  { label: 'Overview', suffix: '' },
  { label: 'Builder', suffix: '/edit' },
  { label: 'Review', suffix: '/review' },
  { label: 'Send', suffix: '/send' },
  { label: 'Activity', suffix: '/activity' },
]

/**
 * The one, simple way to move between a proposal's 5 sections — Overview,
 * Builder, Review, Send, Activity, nothing more. Rendered on Overview/
 * Review/Send/Activity; deliberately NOT added to the Builder page itself
 * (that page's own "Back to Proposal" link already returns here, and the
 * Builder/Editor internals are left untouched).
 */
export function ProposalTabs({ proposalId }: ProposalTabsProps) {
  return (
    <nav className="flex items-center gap-1 border-b border-novara-border">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={`/proposals/${proposalId}${tab.suffix}`}
          end={tab.suffix === ''}
          className={({ isActive }) =>
            `px-3.5 py-2.5 text-sm font-general-sans font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-novara-teal text-white'
                : 'border-transparent text-novara-light/50 hover:text-novara-light'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
