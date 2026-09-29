import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <p className="font-clash-display text-white text-[22px] mb-2">Page not found</p>
      <Link to="/" className="text-sm font-general-sans text-novara-teal hover:text-novara-teal/80">
        Back to Dashboard
      </Link>
    </div>
  )
}
