import { AlertTriangle } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  /** Defaults to the original hardcoded copy — every existing call site is unaffected. */
  heading?: string
}

export function ErrorBanner({ message, heading = 'Could not reach the database' }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 bg-red-400/10 border border-red-400/25 rounded-xl px-4 py-3.5 text-red-300">
      <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-general-sans font-medium">{heading}</p>
        <p className="text-[12px] font-general-sans text-red-300/70 mt-0.5">{message}</p>
      </div>
    </div>
  )
}
