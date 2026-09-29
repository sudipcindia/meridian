import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Sparkles, GraduationCap, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext.js'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles, end: false },
  { to: '/ai-learning', label: 'AI Learning', icon: GraduationCap, end: false },
]

export function Sidebar() {
  const { session, signOut } = useAuth()

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 bg-novara-panel border-r border-novara-border flex flex-col">
      <div className="px-5 py-6">
        <p className="font-clash-display text-[18px] text-white tracking-tight">
          Novara <span className="text-novara-orange">Proposals</span>
        </p>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-general-sans transition-colors ${
                isActive
                  ? 'bg-novara-teal/15 text-novara-teal'
                  : 'text-novara-light/70 hover:bg-white/5 hover:text-novara-light'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-novara-border flex flex-col gap-2">
        <p className="text-[11px] text-novara-light/40 font-general-sans truncate" title={session?.user.email}>
          {session?.user.email}
        </p>
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-2 text-[12px] font-general-sans text-novara-light/50 hover:text-white transition-colors w-fit"
        >
          <LogOut size={13} /> Logout
        </button>
      </div>
    </aside>
  )
}
