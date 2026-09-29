import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Top-level safety net. Without this, any synchronous render-time
 * exception (a malformed document row, a template component throwing)
 * produces a blank white screen with no recovery path — most importantly
 * on the public, unauthenticated /p/:token route, where a client has no
 * other way to reach staff. Logs only the error message, never any
 * proposal content or state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-novara-dark px-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <p className="font-clash-display text-lg text-white">Something went wrong</p>
            <p className="text-[13px] font-general-sans text-novara-light/60 max-w-[360px]">
              Please reload the page. If the problem continues, contact Novara.
            </p>
            {this.state.error.message && (
              <p className="text-[11px] font-mono text-novara-light/40 max-w-[420px] break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-general-sans font-medium bg-novara-teal text-novara-dark px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
