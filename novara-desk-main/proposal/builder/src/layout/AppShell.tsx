import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar.js'

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-novara-dark">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
