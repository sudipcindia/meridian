import { Component, type ErrorInfo, type ReactNode } from 'react'

interface PageFrameErrorBoundaryProps {
  children: ReactNode
  /** For the console log and the internal-view fallback message — not shown to clients. */
  pageId: string
  /** Staff-only views (Editor, Review) show which page failed and why, to help debugging. Client-facing views (ClientProposalView, PdfView) never show internal error detail — a broken page there renders as an inert blank space instead, so a client never sees a raw error and a signing flow never looks broken mid-document. */
  internal?: boolean
}

interface PageFrameErrorBoundaryState {
  error: Error | null
}

/**
 * Wraps ONE page frame (one <LiveTemplatePreview>) rather than the whole
 * app — the top-level ErrorBoundary (components/ErrorBoundary.tsx, mounted
 * once in main.tsx) already exists as a last resort, but it replaces the
 * ENTIRE screen for any unhandled render error anywhere, meaning one bad
 * page in an 11+-page document currently takes every other correctly-
 * rendering page down with it. This is a real, already-proven failure mode
 * (a proposal saved with a page id from an undeployed build crashed its
 * whole Review tab outright) — dynamic AI-decided pages make it more
 * likely to recur, since a malformed/unexpected block shape is exactly the
 * kind of thing generated content can produce. This boundary isolates that
 * failure to the one frame it belongs to.
 */
export class PageFrameErrorBoundary extends Component<PageFrameErrorBoundaryProps, PageFrameErrorBoundaryState> {
  state: PageFrameErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PageFrameErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Page "${this.props.pageId}" failed to render:`, error.message, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    if (!this.props.internal) {
      // Client-facing: silent and inert. No error text, no visible "something
      // broke" chrome — a missing/blank page reads far better mid-document
      // (especially mid-signing-flow) than a stack trace or a scary banner.
      return <div style={{ minHeight: 200 }} aria-hidden="true" />
    }

    return (
      <div
        style={{
          minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#0D1A1F', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 24, textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'General Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Page &quot;{this.props.pageId}&quot; failed to render.
        </p>
        {this.state.error.message && (
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 420, wordBreak: 'break-word', margin: 0 }}>
            {this.state.error.message}
          </p>
        )}
      </div>
    )
  }
}
